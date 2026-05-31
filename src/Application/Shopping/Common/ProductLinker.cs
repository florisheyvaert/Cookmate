using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;

namespace Cookmate.Application.Shopping.Common;

/// <summary>
/// Shared "ensure GroceryProduct exists, add link if not already present"
/// logic between the SKU-based and URL-based link commands. Linking is
/// additive — multiple products per ingredient per store are supported.
/// Idempotent: linking the same product twice to the same ingredient is a
/// no-op (the unique index on (IngredientId, GroceryProductId) backs this).
/// </summary>
public static class ProductLinker
{
    public static async Task<RecipeIngredientProductLink> AddLinkAsync(
        IApplicationDbContext context,
        IGroceryStore store,
        int ingredientId,
        string sku,
        decimal defaultPackQuantity,
        CancellationToken cancellationToken)
    {
        var ingredientExists = await context.Recipes
            .SelectMany(r => r.Ingredients)
            .AnyAsync(i => i.Id == ingredientId, cancellationToken);
        Guard.Against.NotFound(ingredientId, ingredientExists ? "Ingredient" : null);

        var product = await context.GroceryProducts
            .FirstOrDefaultAsync(
                p => p.StoreCode == store.Code && p.Sku == sku,
                cancellationToken);

        // Refresh / fetch product metadata best-effort. Even when we already
        // have a stub row this top-up ensures the cached name/image stay in
        // sync with the store.
        var match = await TryFindCandidateAsync(store, sku, cancellationToken);

        if (product is null)
        {
            product = new GroceryProduct(
                store.Code,
                sku,
                match?.Name ?? $"Product {sku}");
            context.GroceryProducts.Add(product);
        }

        if (match is not null)
        {
            product.UpdateMetadata(
                match.Name,
                match.BrandOrSubtitle,
                match.ImageUrl,
                match.CanonicalUrl,
                match.PackSize,
                match.UnitPrice,
                match.Currency);
        }

        await context.SaveChangesAsync(cancellationToken);

        // If this exact (ingredient, product) is already linked, just adjust
        // the pack quantity on the existing row — adding twice would violate
        // the unique index. This keeps the call idempotent.
        var existing = await context.RecipeIngredientProductLinks
            .FirstOrDefaultAsync(
                l => l.IngredientId == ingredientId && l.GroceryProductId == product.Id,
                cancellationToken);

        if (existing is not null)
        {
            existing.SetDefaultPackQuantity(defaultPackQuantity);
            await context.SaveChangesAsync(cancellationToken);
            return existing;
        }

        var link = new RecipeIngredientProductLink(ingredientId, product, defaultPackQuantity);
        context.RecipeIngredientProductLinks.Add(link);
        await context.SaveChangesAsync(cancellationToken);
        return link;
    }

    private static async Task<GroceryProductCandidate?> TryFindCandidateAsync(
        IGroceryStore store, string sku, CancellationToken cancellationToken)
    {
        try
        {
            return await store.FindBySkuAsync(sku, cancellationToken);
        }
        catch
        {
            return null;
        }
    }
}
