using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Promotions.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.GetPromotions;

/// <summary>
/// A store's cached promotions for one bonus week. With no <see cref="ValidFrom"/> the
/// current week is used (the period covering today, else the next upcoming one).
/// </summary>
public record GetPromotionsQuery : IRequest<IReadOnlyList<PromotionDto>>
{
    public string StoreCode { get; init; } = string.Empty;

    /// <summary>Bonus week to return (its start date). Null = current week.</summary>
    public DateOnly? ValidFrom { get; init; }

    /// <summary>
    /// Null = top-level promos (group tiles + standalone). Set = the member products of that
    /// group SKU (the drill-down view).
    /// </summary>
    public string? GroupSku { get; init; }
}

public class GetPromotionsQueryHandler : IRequestHandler<GetPromotionsQuery, IReadOnlyList<PromotionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPromotionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PromotionDto>> Handle(GetPromotionsQuery request, CancellationToken cancellationToken)
    {
        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();

        var promos = await _context.Promotions.AsNoTracking()
            .Where(p => p.StoreCode == code)
            .ToListAsync(cancellationToken);
        if (promos.Count == 0) return [];

        var week = request.ValidFrom ?? PromoWeeks.Current(promos.Select(p => (p.ValidFrom, p.ValidTo)));
        var inWeek = promos.Where(p => p.ValidFrom == week).ToList();

        // Drill-down: the member products of a specific group.
        if (!string.IsNullOrWhiteSpace(request.GroupSku))
        {
            var groupSku = request.GroupSku.Trim();
            return inWeek
                .Where(p => p.GroupSku == groupSku)
                .OrderBy(p => p.DisplayOrder)
                .Select(p => ToDto(p, 0))
                .ToList();
        }

        // Top-level list: group tiles + standalone promos, each with its member count.
        var memberCounts = inWeek
            .Where(p => p.GroupSku != null)
            .GroupBy(p => p.GroupSku!)
            .ToDictionary(g => g.Key, g => g.Count());

        return inWeek
            .Where(p => p.GroupSku == null)
            .OrderBy(p => p.DisplayOrder)
            .Select(p => ToDto(p, memberCounts.GetValueOrDefault(p.Sku)))
            .ToList();
    }

    private static PromotionDto ToDto(Domain.Entities.Promotion p, int productCount) => new()
    {
        Sku = p.Sku,
        Name = p.Name,
        BrandOrSubtitle = p.BrandOrSubtitle,
        Category = p.Category,
        ImageUrl = p.ImageUrl,
        PackSize = p.PackSize,
        OriginalPrice = p.OriginalPrice,
        PromoPrice = p.PromoPrice,
        DiscountLabel = p.DiscountLabel,
        Currency = p.Currency,
        CanonicalUrl = p.CanonicalUrl,
        ValidFrom = p.ValidFrom,
        ValidTo = p.ValidTo,
        ProductCount = productCount,
    };
}

public record PromotionDto
{
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? BrandOrSubtitle { get; init; }
    public string? Category { get; init; }
    public string? ImageUrl { get; init; }
    public string? PackSize { get; init; }
    public decimal? OriginalPrice { get; init; }
    public decimal? PromoPrice { get; init; }
    public string? DiscountLabel { get; init; }
    public string? Currency { get; init; }

    /// <summary>Link to the product/deal on ah.be (member products only; null for group tiles).</summary>
    public string? CanonicalUrl { get; init; }

    public DateOnly? ValidFrom { get; init; }
    public DateOnly? ValidTo { get; init; }

    /// <summary>How many member products this group has (0 for a member row or standalone promo).</summary>
    public int ProductCount { get; init; }
}
