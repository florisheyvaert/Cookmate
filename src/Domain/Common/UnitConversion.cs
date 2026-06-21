namespace Cookmate.Domain.Common;

public enum UnitFamily
{
    Unknown,
    Mass,
    Volume,
    Count,
}

/// <summary>
/// Shared unit classification + base-unit conversion, used both to compute how many
/// supermarket packs to buy (<see cref="PackQuantityCalculator"/>) and to SUM the needed
/// amount of an ingredient across meals. Base units: grams (mass), millilitres (volume),
/// pieces (count). Spoons/cup are coarse volume approximations — fine for "how much do I
/// need / how many packs", not for precise cooking.
/// </summary>
public static class UnitConversion
{
    public static UnitFamily Classify(string? unit)
    {
        var u = Normalize(unit);
        return u switch
        {
            "" => UnitFamily.Unknown,
            "mg" or "g" or "gr" or "gram" or "grammen" or "kg" or "kilo" or "kilogram" => UnitFamily.Mass,
            "ml" or "cl" or "dl" or "l" or "liter" or "litre" or "tl" or "theelepel" or "el" or "eetlepel" or "cup" => UnitFamily.Volume,
            "st" or "stuk" or "stuks" or "x" or "pcs" or "piece" or "pieces" or "teen" or "tenen" or "bos" or "bosje" => UnitFamily.Count,
            _ => UnitFamily.Unknown,
        };
    }

    /// <summary>Converts an amount to its family base unit (g / ml / piece). Caller should
    /// only sum/compare amounts whose <see cref="Classify"/> families match.</summary>
    public static decimal ToBase(decimal amount, string? unit)
    {
        var u = Normalize(unit);
        return Classify(u) switch
        {
            UnitFamily.Mass => u switch
            {
                "kg" or "kilo" or "kilogram" => amount * 1000m,
                "mg" => amount / 1000m,
                _ => amount, // grams
            },
            UnitFamily.Volume => u switch
            {
                "l" or "liter" or "litre" => amount * 1000m,
                "dl" => amount * 100m,
                "cl" => amount * 10m,
                "el" or "eetlepel" => amount * 15m,
                "tl" or "theelepel" => amount * 5m,
                "cup" => amount * 240m,
                _ => amount, // ml
            },
            _ => amount, // count / unknown — leave as-is
        };
    }

    /// <summary>The canonical short label for a family's base unit, for display after summing.</summary>
    public static string BaseUnitLabel(UnitFamily family) => family switch
    {
        UnitFamily.Mass => "g",
        UnitFamily.Volume => "ml",
        UnitFamily.Count => "st",
        _ => string.Empty,
    };

    private static string Normalize(string? unit) => (unit ?? string.Empty).Trim().ToLowerInvariant();
}
