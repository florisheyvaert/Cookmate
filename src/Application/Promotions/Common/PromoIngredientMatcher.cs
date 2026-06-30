using System.Text.RegularExpressions;
using Cookmate.Domain.Common;

namespace Cookmate.Application.Promotions.Common;

/// <summary>
/// Best-effort matcher between a store promo product title (e.g. "AH Scharrel kipfilet
/// 4-pack") and a recipe/suggestion ingredient name (e.g. "kipfilet", "uien"). Promo titles
/// carry brand/pack noise and ingredient names vary in plural/diminutive form, so we reduce
/// both to a small set of food "stems" and look for overlap.
///
/// Deliberately simple and a touch greedy: in the promo flow the user confirms matches and a
/// confirmation is remembered as an IngredientProductPreference, so recall matters more than
/// precision — a missed match is one the user adds once, after which it is exact.
/// </summary>
public static class PromoIngredientMatcher
{
    // Brand / packaging / marketing tokens that carry no food meaning.
    private static readonly HashSet<string> Noise = new(StringComparer.Ordinal)
    {
        "ah", "bio", "biologisch", "terra", "streeckgenoten", "scharrel", "vers", "verse",
        "fijn", "fijne", "grof", "grove", "de", "het", "een", "met", "en", "of", "per", "voor",
        "extra", "mini", "maxi", "xl", "groot", "grote", "klein", "kleine", "ready", "to", "eat",
        "pack", "multipack", "voordeelverpakking", "grootverpakking", "familieverpakking", "family",
        "stuk", "stuks", "gram", "kg", "ml", "cl", "dl", "liter", "pakket", "pakje", "bakje",
        "zak", "pot", "fairtrade", "naturel", "original",
    };

    private static readonly Regex Tokenizer = new(@"[^a-z]+", RegexOptions.Compiled);

    /// <summary>The set of food stems in a piece of text (promo title or ingredient name).</summary>
    public static IReadOnlyCollection<string> FoodStems(string? text)
    {
        var normalized = IngredientNameNormalizer.Normalize(text);
        var stems = new HashSet<string>(StringComparer.Ordinal);

        foreach (var token in Tokenizer.Split(normalized))
        {
            if (token.Length < 2) continue;
            if (Noise.Contains(token)) continue;

            var stem = Stem(token);
            if (stem.Length >= 2) stems.Add(stem);
        }

        return stems;
    }

    /// <summary>True when any food stem of the ingredient name is covered by the promo product.</summary>
    public static bool Matches(IReadOnlyCollection<string> productStems, string? ingredientName)
    {
        if (productStems.Count == 0) return false;

        foreach (var ing in FoodStems(ingredientName))
        {
            foreach (var prod in productStems)
            {
                if (StemsOverlap(ing, prod)) return true;
            }
        }

        return false;
    }

    private static bool StemsOverlap(string a, string b)
    {
        if (a == b) return true;
        // Substring only for longer stems, to avoid spurious tiny-token matches.
        if (a.Length >= 4 && b.Contains(a, StringComparison.Ordinal)) return true;
        if (b.Length >= 4 && a.Contains(b, StringComparison.Ordinal)) return true;
        return false;
    }

    // Light Dutch pseudo-stem: strip the common plural/diminutive suffix, then collapse a
    // doubled vowel (open→closed syllable spelling change). Folds tomaat/tomaten → "tomat",
    // ui/uien → "ui", garnaal/garnalen → "garnal", kipfilet/kipfilets → "kipfilet".
    private static readonly string[] Suffixes = { "eren", "tjes", "jes", "en", "s" };

    private static string Stem(string token)
    {
        foreach (var suffix in Suffixes)
        {
            if (token.Length - suffix.Length >= 2 && token.EndsWith(suffix, StringComparison.Ordinal))
            {
                token = token[..^suffix.Length];
                break;
            }
        }

        return token
            .Replace("aa", "a")
            .Replace("ee", "e")
            .Replace("oo", "o")
            .Replace("uu", "u");
    }
}
