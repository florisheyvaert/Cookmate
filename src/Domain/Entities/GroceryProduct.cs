namespace Cookmate.Domain.Entities;

/// <summary>
/// Cached metadata about a single SKU at a single grocery store. Shared across
/// all users — this is public catalogue data, not user-owned. Identity is
/// (<see cref="StoreCode"/>, <see cref="Sku"/>).
/// </summary>
public class GroceryProduct : BaseAuditableEntity
{
    public string StoreCode { get; private set; } = string.Empty;

    public string Sku { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? BrandOrSubtitle { get; private set; }

    public string? ImageUrl { get; private set; }

    public string? CanonicalUrl { get; private set; }

    public Quantity PackSize { get; private set; } = new(0, null);

    public decimal? UnitPrice { get; private set; }

    public string? Currency { get; private set; }

    public DateTimeOffset? LastVerifiedAtUtc { get; private set; }

    private GroceryProduct() { }

    public GroceryProduct(string storeCode, string sku, string name)
    {
        SetStoreCode(storeCode);
        SetSku(sku);
        Rename(name);
    }

    public void SetStoreCode(string storeCode)
    {
        if (string.IsNullOrWhiteSpace(storeCode))
            throw new ArgumentException("Store code is required.", nameof(storeCode));
        StoreCode = storeCode.Trim().ToLowerInvariant();
    }

    public void SetSku(string sku)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("SKU is required.", nameof(sku));
        Sku = sku.Trim();
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Product name is required.", nameof(name));
        Name = name.Trim();
    }

    public void UpdateMetadata(
        string name,
        string? brandOrSubtitle,
        string? imageUrl,
        string? canonicalUrl,
        Quantity packSize,
        decimal? unitPrice,
        string? currency)
    {
        Rename(name);
        BrandOrSubtitle = string.IsNullOrWhiteSpace(brandOrSubtitle) ? null : brandOrSubtitle.Trim();
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        CanonicalUrl = string.IsNullOrWhiteSpace(canonicalUrl) ? null : canonicalUrl.Trim();
        PackSize = packSize ?? throw new ArgumentNullException(nameof(packSize));
        UnitPrice = unitPrice;
        Currency = string.IsNullOrWhiteSpace(currency) ? null : currency.Trim();
        LastVerifiedAtUtc = DateTimeOffset.UtcNow;
    }
}
