namespace Cookmate.Domain.Entities;

/// <summary>
/// An ingredient the household never wants on a shopping list — the user's own additions to
/// the built-in "never buy" set. Keyed by normalised name, store-independent.
/// </summary>
public class IgnoredIngredient : BaseAuditableEntity
{
    public string NormalizedName { get; private set; } = string.Empty;

    private IgnoredIngredient() { }

    public IgnoredIngredient(string normalizedName)
    {
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            throw new ArgumentException("Normalised name is required.", nameof(normalizedName));
        }

        NormalizedName = normalizedName.Trim();
    }
}
