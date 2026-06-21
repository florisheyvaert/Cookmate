namespace Cookmate.Domain.Entities;

/// <summary>
/// The user's remembered product choice for an ingredient — keyed by the normalised
/// ingredient name and store, NOT by a specific recipe ingredient row (so it applies across
/// recipes, planned suggestions and future weeks). This is what makes the weekly cart
/// auto-link "the tomatoes you always pick". Overridable per cart.
/// </summary>
public class IngredientProductPreference : BaseAuditableEntity
{
    /// <summary>Normalised ingredient name (see IngredientNameNormalizer) — the lookup key.</summary>
    public string NormalizedName { get; private set; } = string.Empty;

    /// <summary>Store code, denormalised from the product for cheap per-store lookups.</summary>
    public string StoreCode { get; private set; } = string.Empty;

    public int GroceryProductId { get; private set; }

    /// <summary>Fallback pack count when unit math can't derive it.</summary>
    public decimal DefaultPackQuantity { get; private set; } = 1m;

    public GroceryProduct Product { get; private set; } = null!;

    private IngredientProductPreference() { }

    public IngredientProductPreference(string normalizedName, GroceryProduct product, decimal defaultPackQuantity)
    {
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            throw new ArgumentException("Normalised name is required.", nameof(normalizedName));
        }

        ArgumentNullException.ThrowIfNull(product);

        NormalizedName = normalizedName.Trim();
        Product = product;
        StoreCode = product.StoreCode;
        SetDefaultPackQuantity(defaultPackQuantity);
    }

    public void PointAt(GroceryProduct product, decimal defaultPackQuantity)
    {
        ArgumentNullException.ThrowIfNull(product);
        Product = product;
        GroceryProductId = product.Id;
        StoreCode = product.StoreCode;
        SetDefaultPackQuantity(defaultPackQuantity);
    }

    public void SetDefaultPackQuantity(decimal defaultPackQuantity)
    {
        if (defaultPackQuantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(defaultPackQuantity), "Default pack quantity must be positive.");
        }

        DefaultPackQuantity = defaultPackQuantity;
    }
}
