using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Commands.RefreshPromotions;

/// <summary>
/// Pulls the current promotions ("bonus") for a store and refreshes the local cache:
/// upserts a <see cref="GroceryProduct"/> per promo SKU (so the SKU's metadata is known
/// to the cart) and a <see cref="Promotion"/> row, then drops promos that are no longer
/// on offer. A full snapshot replace — running it again is idempotent.
/// </summary>
public record RefreshPromotionsCommand : IRequest<int>
{
    public string StoreCode { get; init; } = string.Empty;
}

public class RefreshPromotionsCommandHandler : IRequestHandler<RefreshPromotionsCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<IStorePromotionSource> _sources;

    public RefreshPromotionsCommandHandler(IApplicationDbContext context, IEnumerable<IStorePromotionSource> sources)
    {
        _context = context;
        _sources = sources;
    }

    public async Task<int> Handle(RefreshPromotionsCommand request, CancellationToken cancellationToken)
    {
        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();
        var source = _sources.FirstOrDefault(s => string.Equals(s.Code, code, StringComparison.OrdinalIgnoreCase));
        Guard.Against.NotFound(code, source);

        var fresh = await source.GetPromotionsAsync(cancellationToken);

        // Batch-load existing rows for this store so the upsert is a few queries, not N.
        var existingProducts = await _context.GroceryProducts
            .Where(p => p.StoreCode == code)
            .ToDictionaryAsync(p => p.Sku, cancellationToken);
        var existingPromotions = await _context.Promotions
            .Where(p => p.StoreCode == code)
            .ToListAsync(cancellationToken);
        var promotionBySku = existingPromotions.ToDictionary(p => p.Sku);

        var freshSkus = new HashSet<string>();

        foreach (var promo in fresh)
        {
            if (string.IsNullOrWhiteSpace(promo.Sku)) continue;
            freshSkus.Add(promo.Sku);

            // Upsert the cached product straight from the promo payload — no extra
            // per-SKU fetch. UnitPrice carries the normal (pre-bonus) price.
            if (!existingProducts.TryGetValue(promo.Sku, out var product))
            {
                product = new GroceryProduct(code, promo.Sku, promo.Name);
                _context.GroceryProducts.Add(product);
                existingProducts[promo.Sku] = product;
            }
            product.UpdateMetadata(
                promo.Name, promo.BrandOrSubtitle, promo.ImageUrl, promo.CanonicalUrl,
                promo.PackSize, promo.OriginalPrice, promo.Currency);

            if (!promotionBySku.TryGetValue(promo.Sku, out var promotion))
            {
                promotion = new Promotion(code, promo.Sku);
                _context.Promotions.Add(promotion);
                promotionBySku[promo.Sku] = promotion;
            }
            promotion.Update(
                promo.DiscountLabel, promo.OriginalPrice, promo.PromoPrice,
                promo.Currency, promo.ValidFrom, promo.ValidTo);
        }

        // Drop promos that are no longer on offer (the snapshot is authoritative).
        var stale = existingPromotions.Where(p => !freshSkus.Contains(p.Sku)).ToList();
        if (stale.Count > 0) _context.Promotions.RemoveRange(stale);

        await _context.SaveChangesAsync(cancellationToken);
        return freshSkus.Count;
    }
}
