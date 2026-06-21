using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetSuggestionFacets;

/// <summary>
/// Tag histogram + total count for the suggestion pool under the given filters
/// (search/source/time — deliberately NOT tag, so the chip counts stay stable when a
/// tag is selected). Computed over the whole matching set, independent of the paged
/// browse list, so the tag counts are complete immediately rather than growing as you
/// scroll.
/// </summary>
public record GetSuggestionFacetsQuery : IRequest<SuggestionFacetsDto>
{
    public string? Search { get; init; }

    public int? SourceId { get; init; }

    public int? MaxTimeMinutes { get; init; }
}

public class GetSuggestionFacetsQueryHandler : IRequestHandler<GetSuggestionFacetsQuery, SuggestionFacetsDto>
{
    private readonly IApplicationDbContext _context;

    public GetSuggestionFacetsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SuggestionFacetsDto> Handle(GetSuggestionFacetsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.MealSuggestions.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var needle = request.Search.Trim().ToLower();
            query = query.Where(s =>
                s.Title.ToLower().Contains(needle) ||
                (s.Summary != null && s.Summary.ToLower().Contains(needle)));
        }

        if (request.SourceId is { } sourceId)
        {
            query = query.Where(s => s.SourceId == sourceId);
        }

        if (request.MaxTimeMinutes is int max && max > 0)
        {
            query = query.Where(s => s.TotalTimeMinutes == null || s.TotalTimeMinutes <= max);
        }

        // Pull just the tag arrays for the matching set and aggregate in memory — the
        // pool is small enough that one round trip is cheaper than an unnest + group.
        var tagLists = await query.Select(s => s.Tags).ToListAsync(cancellationToken);

        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var tags in tagLists)
        {
            foreach (var tag in tags)
            {
                counts[tag] = counts.GetValueOrDefault(tag) + 1;
            }
        }

        var ordered = counts
            .Select(kv => new SuggestionTagCount(kv.Key, kv.Value))
            .OrderByDescending(t => t.Count)
            .ThenBy(t => t.Tag)
            .ToList();

        return new SuggestionFacetsDto { Total = tagLists.Count, Tags = ordered };
    }
}

public record SuggestionFacetsDto
{
    public int Total { get; init; }

    public IReadOnlyList<SuggestionTagCount> Tags { get; init; } = [];
}

public record SuggestionTagCount(string Tag, int Count);
