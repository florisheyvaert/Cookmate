namespace Cookmate.Domain.Entities;

/// <summary>
/// Binds a recipe ingredient to one concrete grocery product. An ingredient
/// can have many links — multiple products at the same store (e.g. butter
/// and roomboter as alternatives) and at different stores. Duplicate
/// products are prevented by a unique index on (IngredientId, GroceryProductId)
/// — since GroceryProduct identity is itself (StoreCode, Sku), the same SKU
/// can't be linked twice to the same ingredient. <see cref="StoreCode"/> is
/// denormalised from the linked <see cref="GroceryProduct"/> so per-store
/// queries stay cheap.
/// </summary>
public class RecipeIngredientProductLink : BaseAuditableEntity
{
    public int IngredientId { get; private set; }

    public int GroceryProductId { get; private set; }

    public string StoreCode { get; private set; } = string.Empty;

    public decimal DefaultPackQuantity { get; private set; }

    public string? UserNote { get; private set; }

    public GroceryProduct Product { get; private set; } = null!;

    private RecipeIngredientProductLink() { }

    public RecipeIngredientProductLink(int ingredientId, GroceryProduct product, decimal defaultPackQuantity)
    {
        if (ingredientId <= 0)
            throw new ArgumentOutOfRangeException(nameof(ingredientId), "Ingredient id must be positive.");

        ArgumentNullException.ThrowIfNull(product);

        IngredientId = ingredientId;
        GroceryProductId = product.Id;
        StoreCode = product.StoreCode;
        Product = product;
        SetDefaultPackQuantity(defaultPackQuantity);
    }

    public void SetDefaultPackQuantity(decimal packs)
    {
        if (packs <= 0)
            throw new ArgumentOutOfRangeException(nameof(packs), "Default pack quantity must be greater than zero.");
        DefaultPackQuantity = packs;
    }

    public void SetUserNote(string? note) =>
        UserNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
}
