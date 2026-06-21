using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Common;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Common;

/// <summary>
/// Builds the weekly cart from the meal plan. The important difference from the per-recipe
/// deeplink projection: it SUMS the needed amount of each ingredient across every meal FIRST,
/// then computes the pack count ONCE — so "1 tomato Monday + 1 tomato Wednesday" becomes "2
/// tomatoes → 1 pack of 6", not "2 packs". Pulls ingredients from both recipe entries (scaled
/// by servings) and planned-suggestion entries (scaled, jsonb ingredients), buckets them into
/// staples / remembered-product / unmatched, and builds the store deeplink.
/// </summary>
public static class WeeklyCartBuilder
{
    public static async Task<WeeklyCartDto> BuildAsync(
        IApplicationDbContext context,
        IGroceryStore store,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        var entries = await context.MealEntries
            .AsNoTracking()
            .Where(e => e.Date >= from && e.Date <= to)
            .ToListAsync(cancellationToken);

        var recipeIds = entries.Where(e => e.RecipeId != null).Select(e => e.RecipeId!.Value).Distinct().ToList();
        var suggestionIds = entries.Where(e => e.MealSuggestionId != null).Select(e => e.MealSuggestionId!.Value).Distinct().ToList();

        var recipes = recipeIds.Count == 0
            ? new List<Recipe>()
            : await context.Recipes.AsNoTracking().Include(r => r.Ingredients)
                .Where(r => recipeIds.Contains(r.Id)).ToListAsync(cancellationToken);
        var recipesById = recipes.ToDictionary(r => r.Id);

        var suggestions = suggestionIds.Count == 0
            ? new List<MealSuggestion>()
            : await context.MealSuggestions.AsNoTracking()
                .Where(s => suggestionIds.Contains(s.Id)).ToListAsync(cancellationToken);
        var suggestionsById = suggestions.ToDictionary(s => s.Id);

        // Aggregate by (normalised name, unit family): sum amounts in the family base unit.
        var lines = new Dictionary<(string Name, UnitFamily Family), AggregatedLine>();

        void Accumulate(string rawName, decimal amount, string? unit, string mealLabel)
        {
            var normalized = IngredientNameNormalizer.Normalize(rawName);
            if (string.IsNullOrEmpty(normalized)) return;

            var family = UnitConversion.Classify(unit);
            var key = (normalized, family);
            if (!lines.TryGetValue(key, out var line))
            {
                line = new AggregatedLine
                {
                    Normalized = normalized,
                    Display = rawName.Trim(),
                    Unit = family == UnitFamily.Unknown ? (unit ?? string.Empty).Trim() : UnitConversion.BaseUnitLabel(family),
                };
                lines[key] = line;
            }

            line.Amount += UnitConversion.ToBase(amount, unit);
            line.Meals.Add(mealLabel);
        }

        foreach (var entry in entries)
        {
            if (entry.RecipeId is { } recipeId && recipesById.TryGetValue(recipeId, out var recipe))
            {
                var factor = recipe.ScaleFactorFor(entry.Servings ?? recipe.BaseServings);
                foreach (var ing in recipe.Ingredients)
                {
                    Accumulate(ing.Name, ing.Quantity.Amount * factor, ing.Quantity.Unit, recipe.Title);
                }
            }
            else if (entry.MealSuggestionId is { } suggestionId && suggestionsById.TryGetValue(suggestionId, out var suggestion))
            {
                var baseServings = suggestion.BaseServings <= 0 ? 1 : suggestion.BaseServings;
                var factor = (decimal)(entry.Servings ?? baseServings) / baseServings;
                foreach (var ing in suggestion.Ingredients)
                {
                    Accumulate(ing.Name, ing.Amount * factor, ing.Unit, suggestion.Title);
                }
            }
            // Plain free-text entries carry no ingredients.
        }

        var names = lines.Keys.Select(k => k.Name).Distinct().ToList();

        // "Never buy" ingredients (built-in + the user's own list) are dropped entirely.
        var ignored = names.Count == 0
            ? new HashSet<string>(StringComparer.Ordinal)
            : (await context.IgnoredIngredients.AsNoTracking()
                .Where(i => names.Contains(i.NormalizedName))
                .Select(i => i.NormalizedName)
                .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.Ordinal);

        // Remembered product choices for this store.
        var preferences = names.Count == 0
            ? new Dictionary<string, IngredientProductPreference>()
            : (await context.IngredientProductPreferences.AsNoTracking().Include(p => p.Product)
                .Where(p => p.StoreCode == store.Code && names.Contains(p.NormalizedName))
                .ToListAsync(cancellationToken))
                .GroupBy(p => p.NormalizedName)
                .ToDictionary(g => g.Key, g => g.First());

        var toBuy = new List<CartItemDto>();
        var probablyHave = new List<CartItemDto>();
        var unmatched = new List<CartItemDto>();

        foreach (var line in lines.Values)
        {
            if (IgnoredIngredients.IsBuiltIn(line.Normalized) || ignored.Contains(line.Normalized))
            {
                continue;
            }

            preferences.TryGetValue(line.Normalized, out var pref);
            var item = line.ToItem(pref);

            // Staples are never auto-bought (the user usually has them); a non-staple with a
            // remembered product is ready to buy; everything else needs a product first.
            if (StapleIngredients.IsStaple(line.Normalized))
            {
                probablyHave.Add(item);
            }
            else if (pref is not null)
            {
                toBuy.Add(item);
            }
            else
            {
                unmatched.Add(item);
            }
        }

        toBuy = toBuy.OrderBy(i => i.IngredientName, StringComparer.OrdinalIgnoreCase).ToList();

        var deeplinkItems = toBuy
            .Where(i => i.Sku is not null && i.Packs is > 0)
            .GroupBy(i => i.Sku!)
            .Select(g => new DeeplinkLineItem(g.Key, g.Sum(i => i.Packs!.Value)));
        var (deeplink, truncated) = TryBuildDeeplink(store, deeplinkItems);

        return new WeeklyCartDto
        {
            StoreCode = store.Code,
            StoreDisplayName = store.DisplayName,
            ToBuy = toBuy,
            ProbablyHave = probablyHave.OrderBy(i => i.IngredientName, StringComparer.OrdinalIgnoreCase).ToList(),
            Unmatched = unmatched.OrderBy(i => i.IngredientName, StringComparer.OrdinalIgnoreCase).ToList(),
            Deeplink = deeplink,
            Truncated = truncated,
        };
    }

    internal static (string? Deeplink, bool Truncated) TryBuildDeeplink(IGroceryStore store, IEnumerable<DeeplinkLineItem> items)
    {
        var list = items.Where(i => i.Quantity > 0 && !string.IsNullOrWhiteSpace(i.Sku)).ToList();
        if (list.Count == 0) return (null, false);

        try
        {
            var result = store.BuildAddToListDeeplink(list);
            return (result.Url.ToString(), result.Truncated);
        }
        catch (ArgumentException)
        {
            return (null, false);
        }
    }

    private sealed class AggregatedLine
    {
        public string Normalized { get; init; } = string.Empty;
        public string Display { get; init; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public HashSet<string> Meals { get; } = new(StringComparer.OrdinalIgnoreCase);

        public CartItemDto ToItem(IngredientProductPreference? pref)
        {
            var item = new CartItemDto
            {
                IngredientName = Display,
                Amount = decimal.Round(Amount, 2),
                Unit = Unit,
                Meals = Meals.ToList(),
            };

            if (pref is null) return item;

            return item with
            {
                Sku = pref.Product.Sku,
                ProductName = pref.Product.Name,
                ImageUrl = pref.Product.ImageUrl,
                Packs = PackQuantityCalculator.Calculate(Amount, Unit, pref.Product.PackSize, pref.DefaultPackQuantity, 1m),
                PackSizeAmount = pref.Product.PackSize.Amount,
                PackSizeUnit = pref.Product.PackSize.Unit,
            };
        }
    }
}
