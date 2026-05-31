using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Common;
using Cookmate.Domain.Entities;

namespace Cookmate.Application.Shopping.Common;

/// <summary>
/// Shared projection logic between single-recipe and multi-recipe deeplink
/// queries. Resolves links per ingredient, applies scaling, sums identical
/// SKUs across recipes (the consolidation that makes the multi-recipe view
/// useful), and asks the store for the final URL.
/// </summary>
public static class ShoppingProjection
{
    public static async Task<ShoppingDeeplinkResultDto> BuildAsync(
        IApplicationDbContext context,
        IGroceryStore store,
        IEnumerable<(Recipe Recipe, decimal Factor)> selections,
        CancellationToken cancellationToken)
    {
        var pairs = selections.ToList();
        var ingredientIds = pairs
            .SelectMany(p => p.Recipe.Ingredients.Select(i => i.Id))
            .Distinct()
            .ToArray();

        // An ingredient can have multiple links per store (e.g. butter and
        // an alternative roomboter). Group rather than ToDictionary on
        // ingredient id — that used to throw on duplicate keys.
        var linksByIngredient = ingredientIds.Length == 0
            ? new Dictionary<int, List<RecipeIngredientProductLink>>()
            : (await context.RecipeIngredientProductLinks
                .AsNoTracking()
                .Include(l => l.Product)
                .Where(l => ingredientIds.Contains(l.IngredientId) && l.StoreCode == store.Code)
                .ToListAsync(cancellationToken))
                .GroupBy(l => l.IngredientId)
                .ToDictionary(g => g.Key, g => g.ToList());

        var mapped = new List<MappedShoppingItemDto>();
        var unmapped = new List<UnmappedShoppingItemDto>();

        foreach (var (recipe, factor) in pairs)
        {
            foreach (var ingredient in recipe.Ingredients)
            {
                if (linksByIngredient.TryGetValue(ingredient.Id, out var ingLinks)
                    && ingLinks.Count > 0)
                {
                    foreach (var link in ingLinks)
                    {
                        var packs = PackQuantityCalculator.Calculate(
                            ingredient.Quantity.Amount,
                            ingredient.Quantity.Unit,
                            link.Product.PackSize,
                            link.DefaultPackQuantity,
                            factor);

                        mapped.Add(new MappedShoppingItemDto
                        {
                            IngredientId = ingredient.Id,
                            RecipeId = recipe.Id,
                            IngredientName = ingredient.Name,
                            Sku = link.Product.Sku,
                            ProductName = link.Product.Name,
                            ImageUrl = link.Product.ImageUrl,
                            Packs = packs,
                            PackSizeAmount = link.Product.PackSize.Amount,
                            PackSizeUnit = link.Product.PackSize.Unit,
                        });
                    }
                }
                else
                {
                    var scaled = ingredient.Quantity.Scale(factor);
                    unmapped.Add(new UnmappedShoppingItemDto
                    {
                        IngredientId = ingredient.Id,
                        RecipeId = recipe.Id,
                        Name = ingredient.Name,
                        Amount = scaled.Amount,
                        Unit = scaled.Unit,
                    });
                }
            }
        }

        // Consolidate identical SKUs across recipes by summing pack counts.
        var consolidated = mapped
            .GroupBy(m => m.Sku)
            .Select(g =>
            {
                var first = g.First();
                var totalPacks = g.Sum(m => m.Packs);
                return first with { Packs = totalPacks };
            })
            .OrderBy(m => m.ProductName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var lineItems = consolidated
            .Select(m => new DeeplinkLineItem(m.Sku, m.Packs))
            .ToList();

        string? deeplink = null;
        var truncated = false;
        if (lineItems.Count > 0)
        {
            try
            {
                var result = store.BuildAddToListDeeplink(lineItems);
                deeplink = result.Url.ToString();
                truncated = result.Truncated;
            }
            catch (ArgumentException)
            {
                // Empty / oversized — leave deeplink null and let the FE surface a message.
            }
        }

        return new ShoppingDeeplinkResultDto
        {
            Deeplink = deeplink,
            StoreCode = store.Code,
            StoreDisplayName = store.DisplayName,
            Mapped = consolidated,
            Unmapped = unmapped
                .OrderBy(u => u.Name, StringComparer.OrdinalIgnoreCase)
                .ToList(),
            Truncated = truncated,
        };
    }
}
