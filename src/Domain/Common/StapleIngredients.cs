namespace Cookmate.Domain.Common;

/// <summary>
/// A built-in list of pantry staples you almost always have in stock, so the weekly cart can
/// pre-bucket them as "probably in stock" rather than "to buy". Matched as a substring against
/// the normalised ingredient name (e.g. "extra vierge olijfolie" → matches "olijfolie").
/// Deliberately conservative — fresh items (garlic, herbs as a bunch) are NOT staples. The user
/// can always move an item to the buy list per cart.
/// </summary>
public static class StapleIngredients
{
    private static readonly string[] Keywords =
    [
        // fats & oils
        "olie", "olijfolie", "zonnebloemolie", "arachideolie", "boter",
        // seasoning
        "zout", "peper", "suiker", "bloem", "azijn", "mosterd",
        // dried spices / herbs
        "paprikapoeder", "komijn", "kaneel", "nootmuskaat", "kurkuma", "kerrie", "currypoeder",
        "oregano", "tijm", "rozemarijn", "laurier", "chilipoeder", "gemberpoeder", "knoflookpoeder",
        // pantry basics
        "bakpoeder", "baking soda", "zuiveringszout", "maïzena", "maizena", "gist",
        "bouillon", "bouillonblok", "honing", "ketchup", "sojasaus", "water",
    ];

    public static bool IsStaple(string normalizedName)
    {
        if (string.IsNullOrWhiteSpace(normalizedName)) return false;
        foreach (var keyword in Keywords)
        {
            if (normalizedName.Contains(keyword, StringComparison.Ordinal)) return true;
        }

        return false;
    }
}
