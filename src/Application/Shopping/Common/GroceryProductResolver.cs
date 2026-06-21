using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Common;

/// <summary>
/// Find-or-create the cached <see cref="GroceryProduct"/> for a store SKU, refreshing its
/// metadata from the store best-effort. Shared by the recipe-link flow and the weekly-cart
/// product-preference flow.
/// </summary>
public static class GroceryProductResolver
{
    public static async Task<GroceryProduct> EnsureAsync(
        IApplicationDbContext context, IGroceryStore store, string sku, CancellationToken cancellationToken)
    {
        var product = await context.GroceryProducts
            .FirstOrDefaultAsync(p => p.StoreCode == store.Code && p.Sku == sku, cancellationToken);

        GroceryProductCandidate? match = null;
        try
        {
            match = await store.FindBySkuAsync(sku, cancellationToken);
        }
        catch
        {
            // Best-effort enrichment — a stub row is fine if the store is unreachable.
        }

        if (product is null)
        {
            product = new GroceryProduct(store.Code, sku, match?.Name ?? $"Product {sku}");
            context.GroceryProducts.Add(product);
        }

        if (match is not null)
        {
            product.UpdateMetadata(
                match.Name, match.BrandOrSubtitle, match.ImageUrl, match.CanonicalUrl,
                match.PackSize, match.UnitPrice, match.Currency);
        }

        await context.SaveChangesAsync(cancellationToken);
        return product;
    }
}
