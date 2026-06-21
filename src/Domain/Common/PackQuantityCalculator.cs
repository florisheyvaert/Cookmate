namespace Cookmate.Domain.Common;

/// <summary>
/// Translates a needed quantity into the number of supermarket packs to buy. When the
/// needed unit and the pack unit belong to the same family (mass / volume / count), divides
/// needed-amount by pack-amount and ceils. When units are incompatible or missing, falls
/// back to the user-defined <c>defaultPackQuantity</c> scaled by servings — also ceiled.
/// Unit classification + base conversion live in <see cref="UnitConversion"/>.
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

        var recipeFamily = UnitConversion.Classify(recipeUnit);
        var packFamily = UnitConversion.Classify(packSize.Unit);

        if (recipeFamily != UnitFamily.Unknown
            && recipeFamily == packFamily
            && packSize.Amount > 0
            && recipeAmount > 0)
        {
            var recipeInBase = UnitConversion.ToBase(recipeAmount * scaleFactor, recipeUnit);
            var packInBase = UnitConversion.ToBase(packSize.Amount, packSize.Unit);
            if (packInBase > 0)
            {
                return CeilToPositive(recipeInBase / packInBase);
            }
        }

        return CeilToPositive(defaultPackQuantity * scaleFactor);
    }

    private static int CeilToPositive(decimal value)
    {
        var ceiled = (int)Math.Ceiling(value);
        return ceiled < 1 ? 1 : ceiled;
    }
}
