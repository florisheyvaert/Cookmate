using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Commands.HarvestMealSuggestions;
using Cookmate.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Runs the automatic harvest on the schedule the user set (weekday + local time), across
/// all enabled sources. Ticks every few minutes and reads the schedule each time, so
/// changes take effect quickly; uses the last scheduled run as a marker, so it fires once
/// per occurrence and catches up a missed run after downtime. In-process / single-instance,
/// which suits this personal app. Manual per-source runs go through the same command.
/// </summary>
public class MealSuggestionHarvestService : BackgroundService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeOnly DefaultTime = new(3, 0);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<MealSuggestionHarvestService> _logger;

    public MealSuggestionHarvestService(
        IServiceScopeFactory scopeFactory,
        TimeProvider timeProvider,
        ILogger<MealSuggestionHarvestService> logger)
    {
        _scopeFactory = scopeFactory;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TickInterval, _timeProvider);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndRunAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled meal-suggestion harvest check failed.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task CheckAndRunAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var schedule = await db.HarvestSchedules.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var enabled = schedule?.Enabled ?? true;
        if (!enabled) return;

        var day = schedule?.DayOfWeek ?? DayOfWeek.Monday;
        var time = schedule?.TimeOfDay ?? DefaultTime;

        var now = _timeProvider.GetLocalNow();
        var occurrence = MostRecentOccurrence(now, day, time);

        var lastScheduled = await db.SuggestionHarvestRuns.AsNoTracking()
            .Where(r => r.Trigger == HarvestTrigger.Scheduled)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => (DateTimeOffset?)r.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        // Due if we've never run on schedule, or the last scheduled run predates the most
        // recent occurrence of the configured weekday/time.
        if (lastScheduled is not null && lastScheduled >= occurrence) return;

        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        var report = await sender.Send(
            new HarvestMealSuggestionsCommand { Trigger = HarvestTrigger.Scheduled },
            cancellationToken);

        _logger.LogInformation(
            "Scheduled harvest finished with status {Status}: {Inserted} inserted, {Skipped} skipped, {Failed} failed.",
            report.Status, report.Inserted, report.SkippedDuplicate, report.Failed);
    }

    /// <summary>The most recent moment matching the configured weekday + time at or before now.</summary>
    private static DateTimeOffset MostRecentOccurrence(DateTimeOffset now, DayOfWeek day, TimeOnly time)
    {
        var diffDays = (int)day - (int)now.DayOfWeek;
        var dateThisWeek = now.Date.AddDays(diffDays);
        var candidate = new DateTimeOffset(dateThisWeek.Add(time.ToTimeSpan()), now.Offset);
        return candidate > now ? candidate.AddDays(-7) : candidate;
    }
}
