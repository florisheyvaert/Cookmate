using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Promotions.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.GetPromoPeriods;

/// <summary>
/// The distinct bonus weeks currently cached for a store — the source for the week
/// filter on the promos screen. Ordered oldest-first, with the current week flagged.
/// </summary>
public record GetPromoPeriodsQuery : IRequest<IReadOnlyList<PromoPeriodDto>>
{
    public string StoreCode { get; init; } = string.Empty;
}

public class GetPromoPeriodsQueryHandler : IRequestHandler<GetPromoPeriodsQuery, IReadOnlyList<PromoPeriodDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPromoPeriodsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PromoPeriodDto>> Handle(GetPromoPeriodsQuery request, CancellationToken cancellationToken)
    {
        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();

        var rows = await _context.Promotions.AsNoTracking()
            .Where(p => p.StoreCode == code && p.ValidFrom != null)
            .GroupBy(p => new { p.ValidFrom, p.ValidTo })
            .Select(g => new { g.Key.ValidFrom, g.Key.ValidTo, Count = g.Count() })
            .ToListAsync(cancellationToken);
        if (rows.Count == 0) return [];

        var current = PromoWeeks.Current(rows.Select(r => (r.ValidFrom, r.ValidTo)));

        return rows
            .OrderBy(r => r.ValidFrom)
            .Select(r => new PromoPeriodDto
            {
                ValidFrom = r.ValidFrom,
                ValidTo = r.ValidTo,
                Count = r.Count,
                IsCurrent = r.ValidFrom == current,
            })
            .ToList();
    }
}

public record PromoPeriodDto
{
    public DateOnly? ValidFrom { get; init; }
    public DateOnly? ValidTo { get; init; }
    public int Count { get; init; }
    public bool IsCurrent { get; init; }
}
