using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;
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

        // A fully empty result means the fetch failed (network/auth) — don't wipe the
        // cache on a bad refresh; keep the last good snapshot.
        if (fresh.Count == 0) return 0;

        // Batch-load existing rows for this store so the upsert is a few queries, not N.
        var existingProducts = await _context.GroceryProducts
            .Where(p => p.StoreCode == code)
            .ToDictionaryAsync(p => p.Sku, cancellationToken);
        var existingPromotions = await _context.Promotions
            .Where(p => p.StoreCode == code)
            .ToListAsync(cancellationToken);
        // Identity is per bonus week, so the same SKU can appear twice (two visible weeks).
        var promotionByKey = existingPromotions.ToDictionary(p => (p.Sku, p.ValidFrom));

        var freshKeys = new HashSet<(string, DateOnly?)>();

        // The source returns promos in the store's own folder order (category by category);
        // keep that as a stable DisplayOrder so the listing matches the website.
        var order = 0;
        foreach (var promo in fresh)
        {
            if (string.IsNullOrWhiteSpace(promo.Sku)) continue;
            var displayOrder = order++;
            freshKeys.Add((promo.Sku, promo.ValidFrom));

            // Only single products are cart-linkable (a CanonicalUrl means a real webshop
            // SKU). Combi-group tiles carry no product — keep them as promo rows only, and
            // don't pollute the grocery catalogue with synthetic SKUs.
            if (promo.CanonicalUrl is not null)
            {
                if (!existingProducts.TryGetValue(promo.Sku, out var product))
                {
                    product = new GroceryProduct(code, promo.Sku, promo.Name);
                    _context.GroceryProducts.Add(product);
                    existingProducts[promo.Sku] = product;
                }
                product.UpdateMetadata(
                    promo.Name, promo.BrandOrSubtitle, promo.ImageUrl, promo.CanonicalUrl,
                    promo.PackSize, promo.OriginalPrice, promo.Currency);
            }

            if (!promotionByKey.TryGetValue((promo.Sku, promo.ValidFrom), out var promotion))
            {
                promotion = new Promotion(code, promo.Sku);
                _context.Promotions.Add(promotion);
                promotionByKey[(promo.Sku, promo.ValidFrom)] = promotion;
            }
            promotion.Update(
                promo.Name, promo.BrandOrSubtitle, promo.Category, promo.GroupSku, displayOrder, promo.ImageUrl,
                FormatPackSize(promo.PackSize), promo.CanonicalUrl, promo.DiscountLabel,
                promo.OriginalPrice, promo.PromoPrice, promo.Currency, promo.ValidFrom, promo.ValidTo);
        }

        // Drop promos that are no longer on offer (the snapshot is authoritative).
        var stale = existingPromotions.Where(p => !freshKeys.Contains((p.Sku, p.ValidFrom))).ToList();
        if (stale.Count > 0) _context.Promotions.RemoveRange(stale);

        await _context.SaveChangesAsync(cancellationToken);
        return freshKeys.Count;
    }

    private static string? FormatPackSize(Quantity? packSize)
    {
        if (packSize is null || string.IsNullOrWhiteSpace(packSize.Unit)) return null;
        return packSize.Amount > 0 ? $"{packSize.Amount:0.##} {packSize.Unit}" : packSize.Unit;
    }
}
