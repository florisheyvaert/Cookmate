using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.ListPromotionRuns;

/// <summary>
/// Recent promotion-refresh runs with their per-store outcome, for the Integrations
/// diagnostics panel. Includes the scheduled runs so past failures stay inspectable.
/// </summary>
public record ListPromotionRunsQuery : IRequest<IReadOnlyList<IntegrationRunReport>>
{
    public int Take { get; init; } = 20;
}

public class ListPromotionRunsQueryHandler : IRequestHandler<ListPromotionRunsQuery, IReadOnlyList<IntegrationRunReport>>
{
    private readonly IApplicationDbContext _context;

    public ListPromotionRunsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<IntegrationRunReport>> Handle(
        ListPromotionRunsQuery request, CancellationToken cancellationToken)
    {
        var take = Math.Clamp(request.Take, 1, 100);

        var runs = await _context.IntegrationRuns.AsNoTracking()
            .Where(r => r.Kind == IntegrationJobKind.Promotions)
            .OrderByDescending(r => r.StartedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        return runs.Select(IntegrationRunReport.From).ToList();
    }
}
