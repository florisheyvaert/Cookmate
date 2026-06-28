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

        return promos
            .Where(p => p.ValidFrom == week)
            .Select(p => new PromotionDto
            {
                Sku = p.Sku,
                Name = p.Name,
                BrandOrSubtitle = p.BrandOrSubtitle,
                ImageUrl = p.ImageUrl,
                PackSize = p.PackSize,
                OriginalPrice = p.OriginalPrice,
                PromoPrice = p.PromoPrice,
                DiscountLabel = p.DiscountLabel,
                Currency = p.Currency,
                ValidFrom = p.ValidFrom,
                ValidTo = p.ValidTo,
            })
            .OrderBy(p => p.Name)
            .ToList();
    }
}

public record PromotionDto
{
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? BrandOrSubtitle { get; init; }
    public string? ImageUrl { get; init; }
    public string? PackSize { get; init; }
    public decimal? OriginalPrice { get; init; }
    public decimal? PromoPrice { get; init; }
    public string? DiscountLabel { get; init; }
    public string? Currency { get; init; }
    public DateOnly? ValidFrom { get; init; }
    public DateOnly? ValidTo { get; init; }
}
