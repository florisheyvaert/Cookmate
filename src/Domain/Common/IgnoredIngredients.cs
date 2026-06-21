namespace Cookmate.Domain.Common;

/// <summary>
/// Built-in "never buy" ingredients — things that appear in recipes but you never add to a
/// basket (tap water, ice…). Matched by exact normalised name (not substring) so it doesn't
/// catch real products like kokoswater or rozenwater. The user can extend this with their own
/// persisted ignore list (<see cref="Entities.IgnoredIngredient"/>).
/// </summary>
public static class IgnoredIngredients
{
    private static readonly HashSet<string> Names = new(StringComparer.Ordinal)
    {
        "water", "heet water", "warm water", "koud water", "lauw water", "kraanwater", "kokend water",
        "ijs", "ijsblokjes", "ijsklontjes",
    };

    public static bool IsBuiltIn(string normalizedName) => Names.Contains(normalizedName);
}
