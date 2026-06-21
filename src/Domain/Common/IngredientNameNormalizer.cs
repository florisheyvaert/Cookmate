using System.Text.RegularExpressions;

namespace Cookmate.Domain.Common;

/// <summary>
/// Produces a stable key for an ingredient name so the same ingredient merges across meals
/// and remembers its chosen product. Conservative on purpose: lower-cases, trims, and
/// collapses whitespace — it does NOT attempt plural folding (Dutch plurals like
/// tomaat/tomaten don't fold safely), so two recipes that spell an ingredient differently
/// stay separate (each can still remember its own product).
/// </summary>
public static class IngredientNameNormalizer
{
    public static string Normalize(string? name)
    {
        var value = (name ?? string.Empty).Trim().ToLowerInvariant();
        return Regex.Replace(value, @"\s+", " ");
    }
}
