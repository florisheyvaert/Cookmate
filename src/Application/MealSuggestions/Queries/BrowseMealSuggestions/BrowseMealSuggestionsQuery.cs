using Cookmate.Application.Common;
using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.BrowseMealSuggestions;

/// <summary>
/// Browses the harvested suggestion pool. 'search' matches title/summary;
/// 'tag' is an exact tag match; 'sourceId' filters to one source; 'maxTimeMinutes'
/// caps total time (suggestions with no time always pass).
/// </summary>
public record BrowseMealSuggestionsQuery : IRequest<IReadOnlyList<MealSuggestionDto>>
{
    public string? Search { get; init; }

    public string? Tag { get; init; }

    public int? SourceId { get; init; }

    public int? MaxTimeMinutes { get; init; }

    /// <summary>Sort order: "newest" (default, date created desc), "oldest", or "title".</summary>
    public string? Sort { get; init; }

    /// <summary>1-based page number for scroll-to-load paging.</summary>
    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 24;
}

public class BrowseMealSuggestionsQueryHandler
    : IRequestHandler<BrowseMealSuggestionsQuery, IReadOnlyList<MealSuggestionDto>>
{
    private readonly IApplicationDbContext _context;

    public BrowseMealSuggestionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<MealSuggestionDto>> Handle(
        BrowseMealSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.MealSuggestions.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var needle = request.Search.Trim().ToLower();
            query = query.Where(s =>
                s.Title.ToLower().Contains(needle) ||
                (s.Summary != null && s.Summary.ToLower().Contains(needle)));
        }

        if (!string.IsNullOrWhiteSpace(request.Tag))
        {
            var tag = request.Tag.Trim().ToLower();
            query = query.Where(s => s.Tags.Contains(tag));
        }

        if (request.SourceId is { } sourceId)
        {
            query = query.Where(s => s.SourceId == sourceId);
        }

        if (request.MaxTimeMinutes is int max && max > 0)
        {
            query = query.Where(s => s.TotalTimeMinutes == null || s.TotalTimeMinutes <= max);
        }

        var favicons = await SourceFaviconLookup.LoadAsync(_context, cancellationToken);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        // Sort by date created (audit timestamp). Id is the stable tiebreak so paging
        // never drops or repeats a row when many share the same timestamp.
        query = request.Sort switch
        {
            "oldest" => query.OrderBy(s => s.Created).ThenBy(s => s.Id),
            "title" => query.OrderBy(s => s.Title).ThenBy(s => s.Id),
            _ => query.OrderByDescending(s => s.Created).ThenByDescending(s => s.Id),
        };

        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.Title,
                s.Summary,
                s.SourceUrl,
                s.SourceId,
                SourceName = _context.SuggestionSources
                    .Where(src => src.Id == s.SourceId)
                    .Select(src => src.Name)
                    .FirstOrDefault(),
                s.BaseServings,
                s.TotalTimeMinutes,
                Tags = s.Tags.ToList(),
                s.HarvestedOn,
                HasImage = s.ImageStorageKey != null,
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(s => new MealSuggestionDto
            {
                Id = s.Id,
                Title = s.Title,
                Summary = s.Summary,
                SourceUrl = s.SourceUrl,
                SourceId = s.SourceId,
                SourceName = s.SourceName,
                SourceFaviconUrl = favicons.ForSourceId(s.SourceId),
                BaseServings = s.BaseServings,
                TotalTimeMinutes = s.TotalTimeMinutes,
                Tags = s.Tags,
                HarvestedOn = s.HarvestedOn,
                ImageUrl = s.HasImage ? $"/api/MealSuggestions/{s.Id}/image" : null,
            })
            .ToList();
    }
}

public record MealSuggestionDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public string SourceUrl { get; init; } = string.Empty;

    public int SourceId { get; init; }

    public string? SourceName { get; init; }

    /// <summary>Relative URL of the source site's locally-stored favicon, or null.</summary>
    public string? SourceFaviconUrl { get; init; }

    public int BaseServings { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = [];

    public DateOnly HarvestedOn { get; init; }

    /// <summary>URL (relative to the API) of the locally stored cover image, or null when none.</summary>
    public string? ImageUrl { get; init; }
}
