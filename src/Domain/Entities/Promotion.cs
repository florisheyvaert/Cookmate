namespace Cookmate.Domain.Entities;

/// <summary>
/// A promotion ("bonus") for a single SKU at a single store, for one bonus week.
/// Shared catalogue data, not user-owned — identity is (<see cref="StoreCode"/>,
/// <see cref="Sku"/>, <see cref="ValidFrom"/>) so the same product can be on bonus in
/// two visible weeks at once. Refreshed in bulk from the store; expired rows are pruned.
/// Carries its own display fields (name, image, pack size) so combi-deal tiles that have
/// no individual product — most of the bonus folder — still render; for single-product
/// promos a matching <see cref="GroceryProduct"/> also exists (by SKU) for the cart.
/// Prices are nullable because multi-buy mechanisms ("2 voor 0.99", "1 + 1 gratis") have
/// no single before/after price — <see cref="DiscountLabel"/> is the reliable value then.
/// </summary>
public class Promotion : BaseAuditableEntity
{
    public string StoreCode { get; private set; } = string.Empty;

    public string Sku { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? BrandOrSubtitle { get; private set; }

    public string? ImageUrl { get; private set; }

    public string? PackSize { get; private set; }

    public string? CanonicalUrl { get; private set; }

    public string? DiscountLabel { get; private set; }

    public decimal? OriginalPrice { get; private set; }

    public decimal? PromoPrice { get; private set; }

    public string? Currency { get; private set; }

    public DateOnly? ValidFrom { get; private set; }

    public DateOnly? ValidTo { get; private set; }

    public DateTimeOffset FetchedAtUtc { get; private set; }

    private Promotion() { }

    public Promotion(string storeCode, string sku)
    {
        SetStoreCode(storeCode);
        SetSku(sku);
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

    public void Update(
        string name,
        string? brandOrSubtitle,
        string? imageUrl,
        string? packSize,
        string? canonicalUrl,
        string? discountLabel,
        decimal? originalPrice,
        decimal? promoPrice,
        string? currency,
        DateOnly? validFrom,
        DateOnly? validTo)
    {
        Name = string.IsNullOrWhiteSpace(name) ? Sku : name.Trim();
        BrandOrSubtitle = string.IsNullOrWhiteSpace(brandOrSubtitle) ? null : brandOrSubtitle.Trim();
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        PackSize = string.IsNullOrWhiteSpace(packSize) ? null : packSize.Trim();
        CanonicalUrl = string.IsNullOrWhiteSpace(canonicalUrl) ? null : canonicalUrl.Trim();
        DiscountLabel = string.IsNullOrWhiteSpace(discountLabel) ? null : discountLabel.Trim();
        OriginalPrice = originalPrice;
        PromoPrice = promoPrice;
        Currency = string.IsNullOrWhiteSpace(currency) ? null : currency.Trim();
        ValidFrom = validFrom;
        ValidTo = validTo;
        FetchedAtUtc = DateTimeOffset.UtcNow;
    }
}
