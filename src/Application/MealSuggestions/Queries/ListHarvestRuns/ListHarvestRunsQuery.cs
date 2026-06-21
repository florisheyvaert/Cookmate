using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.ListHarvestRuns;

/// <summary>
/// Recent harvest runs with their full per-URL report, for the diagnostics UI.
/// Optionally filtered to a single source's manual runs. Includes the weekly
/// auto-runs so past failures stay inspectable.
/// </summary>
public record ListHarvestRunsQuery : IRequest<IReadOnlyList<HarvestReport>>
{
    public int? SourceId { get; init; }

    public int Take { get; init; } = 20;
}

public class ListHarvestRunsQueryHandler : IRequestHandler<ListHarvestRunsQuery, IReadOnlyList<HarvestReport>>
{
    private readonly IApplicationDbContext _context;

    public ListHarvestRunsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<HarvestReport>> Handle(
        ListHarvestRunsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.SuggestionHarvestRuns.AsNoTracking().AsQueryable();

        if (request.SourceId is { } sourceId)
        {
            query = query.Where(r => r.SourceId == sourceId);
        }

        var take = Math.Clamp(request.Take, 1, 100);

        var runs = await query
            .OrderByDescending(r => r.StartedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        return runs.Select(HarvestReport.From).ToList();
    }
}
