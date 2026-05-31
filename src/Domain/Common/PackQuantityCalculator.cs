namespace Cookmate.Domain.Common;

/// <summary>
/// Translates a recipe's per-ingredient quantity into the number of supermarket
/// packs to buy. When recipe and pack units belong to the same family
/// (mass / volume / count), divides recipe-amount by pack-amount and ceils.
/// When units are incompatible or missing, falls back to the user-defined
/// <c>defaultPackQuantity</c> scaled by servings — also ceiled.
/// </summary>
public static class PackQuantityCalculator
{
    public static int Calculate(
        decimal recipeAmount,
        string? recipeUnit,
        Quantity packSize,
        decimal defaultPackQuantity,
        decimal scaleFactor)
    {
        ArgumentNullException.ThrowIfNull(packSize);
        if (scaleFactor <= 0) throw new ArgumentOutOfRangeException(nameof(scaleFactor));
        if (defaultPackQuantity <= 0) throw new ArgumentOutOfRangeException(nameof(defaultPackQuantity));

        var recipeFamily = ClassifyUnit(recipeUnit);
        var packFamily = ClassifyUnit(packSize.Unit);

        if (recipeFamily != UnitFamily.Unknown
            && recipeFamily == packFamily
            && packSize.Amount > 0
            && recipeAmount > 0)
        {
            var recipeInBase = ToBaseUnit(recipeAmount * scaleFactor, recipeUnit, recipeFamily);
            var packInBase = ToBaseUnit(packSize.Amount, packSize.Unit, packFamily);
            if (packInBase > 0)
            {
                var packs = recipeInBase / packInBase;
                return CeilToPositive(packs);
            }
        }

        return CeilToPositive(defaultPackQuantity * scaleFactor);
    }

    private enum UnitFamily { Unknown, Mass, Volume, Count }

    private static UnitFamily ClassifyUnit(string? unit)
    {
        var u = (unit ?? string.Empty).Trim().ToLowerInvariant();
        return u switch
        {
            "" => UnitFamily.Unknown,
            "g" or "gr" or "gram" or "grammen" or "kg" or "kilogram" => UnitFamily.Mass,
            "ml" or "cl" or "dl" or "l" or "liter" or "litre" => UnitFamily.Volume,
            "st" or "stuk" or "stuks" or "x" or "pcs" or "piece" or "pieces" or "teen" or "tenen" or "bos" or "bosje" => UnitFamily.Count,
            _ => UnitFamily.Unknown,
        };
    }

    private static decimal ToBaseUnit(decimal amount, string? unit, UnitFamily family)
    {
        var u = (unit ?? string.Empty).Trim().ToLowerInvariant();
        return family switch
        {
            UnitFamily.Mass => u switch
            {
                "kg" or "kilogram" => amount * 1000m,
                _ => amount, // grams
            },
            UnitFamily.Volume => u switch
            {
                "l" or "liter" or "litre" => amount * 1000m,
                "dl" => amount * 100m,
                "cl" => amount * 10m,
                _ => amount, // ml
            },
            UnitFamily.Count => amount,
            _ => amount,
        };
    }

    private static int CeilToPositive(decimal value)
    {
        var ceiled = (int)Math.Ceiling(value);
        return ceiled < 1 ? 1 : ceiled;
    }
}
