using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.GetPromotions;

/// <summary>The store's current cached promotions, joined with product metadata for display.</summary>
public record GetPromotionsQuery : IRequest<IReadOnlyList<PromotionDto>>
{
    public string StoreCode { get; init; } = string.Empty;
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

        var skus = promos.Select(p => p.Sku).ToHashSet();
        var products = await _context.GroceryProducts.AsNoTracking()
            .Where(p => p.StoreCode == code && skus.Contains(p.Sku))
            .ToListAsync(cancellationToken);
        var productBySku = products.ToDictionary(p => p.Sku);

        return promos
            .Select(p =>
            {
                productBySku.TryGetValue(p.Sku, out var product);
                return new PromotionDto
                {
                    Sku = p.Sku,
                    Name = product?.Name ?? p.Sku,
                    BrandOrSubtitle = product?.BrandOrSubtitle,
                    ImageUrl = product?.ImageUrl,
                    PackSize = FormatPackSize(product?.PackSize?.Amount, product?.PackSize?.Unit),
                    OriginalPrice = p.OriginalPrice,
                    PromoPrice = p.PromoPrice,
                    DiscountLabel = p.DiscountLabel,
                    Currency = p.Currency,
                    ValidFrom = p.ValidFrom,
                    ValidTo = p.ValidTo,
                };
            })
            .OrderBy(p => p.Name)
            .ToList();
    }

    private static string? FormatPackSize(decimal? amount, string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit)) return null;
        return amount is > 0 ? $"{amount.Value:0.##} {unit}" : unit;
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
