using System.Text;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Cookmate.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Commands.HarvestMealSuggestions;

/// <summary>
/// Scrapes meal suggestions from the configured sources. With no <see cref="SourceId"/>
/// it runs every enabled source (the weekly job); with one set it runs that single
/// source on demand (the UI "Harvest now" button) regardless of its enabled flag.
/// Every source and every URL is handled best-effort: failures are caught and recorded
/// rather than aborting the run, and the whole outcome is persisted as a
/// <see cref="SuggestionHarvestRun"/> and returned as a <see cref="HarvestReport"/>.
/// </summary>
public record HarvestMealSuggestionsCommand : IRequest<HarvestReport>
{
    /// <summary>Run a single source by id; null runs all enabled sources.</summary>
    public int? SourceId { get; init; }

    public HarvestTrigger Trigger { get; init; } = HarvestTrigger.Manual;
}

public class HarvestMealSuggestionsCommandHandler : IRequestHandler<HarvestMealSuggestionsCommand, HarvestReport>
{
    private readonly IApplicationDbContext _context;
    private readonly IRecipeUrlDiscovererRegistry _discoverers;
    private readonly IRecipeScraperRegistry _scrapers;
    private readonly IImageDownloader _imageDownloader;
    private readonly TimeProvider _timeProvider;

    public HarvestMealSuggestionsCommandHandler(
        IApplicationDbContext context,
        IRecipeUrlDiscovererRegistry discoverers,
        IRecipeScraperRegistry scrapers,
        IImageDownloader imageDownloader,
        TimeProvider timeProvider)
    {
        _context = context;
        _discoverers = discoverers;
        _scrapers = scrapers;
        _imageDownloader = imageDownloader;
        _timeProvider = timeProvider;
    }

    public async Task<HarvestReport> Handle(HarvestMealSuggestionsCommand request, CancellationToken cancellationToken)
    {
        var startedAt = _timeProvider.GetUtcNow();
        var today = DateOnly.FromDateTime(startedAt.UtcDateTime);

        var sources = request.SourceId is { } id
            ? await _context.SuggestionSources.Where(s => s.Id == id).ToListAsync(cancellationToken)
            : await _context.SuggestionSources.Where(s => s.Enabled).ToListAsync(cancellationToken);

        var run = new SuggestionHarvestRun(request.Trigger, startedAt, request.SourceId);

        // Dedup against everything already in the pool plus anything inserted earlier
        // in this same run (guards the unique SourceUrl index when two listing pages
        // or two sources surface the same recipe).
        var seen = (await _context.MealSuggestions
            .Select(s => s.SourceUrl)
            .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var sourceLogs = new List<HarvestSourceLog>();
        foreach (var source in sources)
        {
            var log = await HarvestSourceAsync(source, today, seen, cancellationToken);
            source.RecordRun(startedAt, StatusOf(log), log.Inserted);
            sourceLogs.Add(log);
        }

        run.Complete(sourceLogs, _timeProvider.GetUtcNow());
        _context.SuggestionHarvestRuns.Add(run);
        await _context.SaveChangesAsync(cancellationToken);

        return HarvestReport.From(run);
    }

    private async Task<HarvestSourceLog> HarvestSourceAsync(
        SuggestionSource source, DateOnly today, HashSet<string> seen, CancellationToken cancellationToken)
    {
        var items = new List<HarvestItemLog>();
        var inserted = 0;
        var skipped = 0;
        var failed = 0;

        IReadOnlyList<Uri> urls;
        try
        {
            urls = await _discoverers.For(source.Host).DiscoverAsync(source, cancellationToken);
        }
        catch (Exception ex)
        {
            // Discovery failed: no items attempted, record against the whole source.
            return new HarvestSourceLog
            {
                SourceId = source.Id,
                SourceName = source.Name,
                Host = source.Host,
                Error = Describe(ex),
            };
        }

        // Cap counts NEW inserts, not discovered URLs: each run adds up to MaxPerRun
        // fresh recipes and skips ones already in the pool, so weekly runs progressively
        // fill the pool from a large sitemap instead of stalling on the same first page.
        var cap = source.MaxPerRun ?? int.MaxValue;
        var scraper = _scrapers.For(source.Host);
        foreach (var url in urls)
        {
            if (inserted >= cap) break;

            var urlStr = url.ToString();

            // Already in the pool (or seen earlier this run): count it but skip silently —
            // a large sitemap would otherwise add thousands of duplicate log entries.
            if (!seen.Add(urlStr))
            {
                skipped++;
                continue;
            }

            try
            {
                var scraped = await scraper.ScrapeAsync(url, cancellationToken);
                var title = string.IsNullOrWhiteSpace(scraped.Title) ? url.Host : scraped.Title;

                var suggestion = new MealSuggestion(source.Id, title, urlStr, today, scraped.BaseServings);
                suggestion.SetSummary(scraped.Summary);
                suggestion.SetTotalTimeMinutes(scraped.TotalTimeMinutes);
                suggestion.SetTags(scraped.Tags);
                suggestion.SetIngredients(scraped.Ingredients
                    .Select(i => new SuggestionIngredient(i.Name, i.Amount, i.Unit, i.Notes)));
                suggestion.SetSteps(scraped.Steps);

                if (!string.IsNullOrWhiteSpace(scraped.ImageUrl)
                    && Uri.TryCreate(scraped.ImageUrl, UriKind.Absolute, out var imageUri))
                {
                    var media = await _imageDownloader.DownloadAsync(imageUri, cancellationToken);
                    if (media is not null)
                    {
                        suggestion.SetImage(media.StorageKey);
                    }
                }

                _context.MealSuggestions.Add(suggestion);
                inserted++;
                items.Add(new HarvestItemLog { Url = urlStr, Status = HarvestItemStatus.Inserted, Title = title });
            }
            catch (Exception ex)
            {
                failed++;
                items.Add(new HarvestItemLog { Url = urlStr, Status = HarvestItemStatus.Failed, Error = Describe(ex) });
            }
        }

        return new HarvestSourceLog
        {
            SourceId = source.Id,
            SourceName = source.Name,
            Host = source.Host,
            Discovered = urls.Count,
            Inserted = inserted,
            SkippedDuplicate = skipped,
            Failed = failed,
            Items = items,
        };
    }

    /// <summary>
    /// Renders an exception into a self-contained, copy-pasteable diagnostic: the full
    /// exception chain (type + message) followed by the stack trace, so a failure report
    /// pinpoints the source, the page, and exactly where it broke.
    /// </summary>
    private static string Describe(Exception ex)
    {
        var sb = new StringBuilder();

        var current = ex;
        var depth = 0;
        while (current is not null && depth < 6)
        {
            sb.Append(depth == 0 ? string.Empty : "  --> ");
            sb.Append(current.GetType().FullName);
            sb.Append(": ");
            sb.AppendLine(current.Message);
            current = current.InnerException;
            depth++;
        }

        if (!string.IsNullOrWhiteSpace(ex.StackTrace))
        {
            sb.AppendLine();
            sb.AppendLine(ex.StackTrace);
        }

        return sb.ToString().TrimEnd();
    }

    private static HarvestStatus StatusOf(HarvestSourceLog log)
    {
        if (log.Error is not null && log.Inserted == 0 && log.SkippedDuplicate == 0)
        {
            return HarvestStatus.Failed;
        }

        var anyFailure = log.Failed > 0 || log.Error is not null;
        if (!anyFailure)
        {
            return HarvestStatus.Succeeded;
        }

        return log.Inserted > 0 || log.SkippedDuplicate > 0
            ? HarvestStatus.PartialFailure
            : HarvestStatus.Failed;
    }
}
