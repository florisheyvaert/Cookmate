using Cookmate.Domain.Common;
using Cookmate.Domain.Enums;

namespace Cookmate.Domain.Entities;

/// <summary>
/// One line in the household's shopping cart. The cart is the whole table — there is no
/// per-user scoping (like the meal plan and preferences, it's shared). A line is either
/// linked to a real store product (<see cref="StoreCode"/> + <see cref="Sku"/>, carrying
/// a cached name/image) or free text for things you can't find in the catalogue. The
/// <see cref="NormalizedName"/> drives dedupe and the "what can I make?" matching.
/// </summary>
public class ShoppingCartItem : BaseAuditableEntity
{
    /// <summary>What the shopper sees — a product name or free-text label.</summary>
    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>Normalised <see cref="DisplayName"/>, for dedupe and dish matching.</summary>
    public string NormalizedName { get; private set; } = string.Empty;

    /// <summary>Set together with <see cref="Sku"/> when linked to a real product; null for free text.</summary>
    public string? StoreCode { get; private set; }

    public string? Sku { get; private set; }

    /// <summary>Cached product image so the cart renders without a per-item lookup.</summary>
    public string? ImageUrl { get; private set; }

    /// <summary>
    /// Store aisle/category (e.g. "Zuivel"), carried over from the promotion the line was added
    /// from. Null for free text and meal-plan lines — those fall under "Other" when sorting.
    /// Display-only: it drives the cart's category sort, nothing else.
    /// </summary>
    public string? Category { get; private set; }

    public int Quantity { get; private set; } = 1;

    public CartItemSource Source { get; private set; }

    /// <summary>True when this line points at a real store product (cart can deep-link it).</summary>
    public bool IsLinked => StoreCode is not null && Sku is not null;

    private ShoppingCartItem() { }

    private ShoppingCartItem(string displayName, int quantity, CartItemSource source)
    {
        Rename(displayName);
        Quantity = quantity < 1 ? 1 : quantity;
        Source = source;
    }

    /// <summary>A free-text line — something not in the catalogue.</summary>
    public static ShoppingCartItem FreeText(
        string displayName, int quantity = 1, CartItemSource source = CartItemSource.Manual, string? category = null)
    {
        var item = new ShoppingCartItem(displayName, quantity, source);
        item.SetCategory(category);
        return item;
    }

    /// <summary>A line linked to a store product.</summary>
    public static ShoppingCartItem Product(
        string storeCode, string sku, string displayName,
        string? imageUrl = null, int quantity = 1, CartItemSource source = CartItemSource.Manual, string? category = null)
    {
        var item = new ShoppingCartItem(displayName, quantity, source);
        item.LinkProduct(storeCode, sku, displayName, imageUrl);
        item.SetCategory(category);
        return item;
    }

    public void Rename(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Cart item needs a name.", nameof(displayName));
        }

        DisplayName = displayName.Trim();
        NormalizedName = IngredientNameNormalizer.Normalize(DisplayName);
    }

    /// <summary>Points a (possibly free-text) line at a real store product.</summary>
    public void LinkProduct(string storeCode, string sku, string? productName = null, string? imageUrl = null)
    {
        if (string.IsNullOrWhiteSpace(storeCode)) throw new ArgumentException("Store code is required.", nameof(storeCode));
        if (string.IsNullOrWhiteSpace(sku)) throw new ArgumentException("SKU is required.", nameof(sku));

        StoreCode = storeCode.Trim().ToLowerInvariant();
        Sku = sku.Trim();
        if (imageUrl is not null) ImageUrl = imageUrl;
        if (!string.IsNullOrWhiteSpace(productName)) Rename(productName);
    }

    /// <summary>Drops the product link, keeping the line as free text.</summary>
    public void Unlink()
    {
        StoreCode = null;
        Sku = null;
        ImageUrl = null;
    }

    /// <summary>Sets the display category, trimming blanks to null.</summary>
    public void SetCategory(string? category)
        => Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim();

    public void SetQuantity(int quantity) => Quantity = quantity < 1 ? 1 : quantity;

    public void Add(int delta) => SetQuantity(Quantity + delta);

    public void SetSource(CartItemSource source) => Source = source;
}
