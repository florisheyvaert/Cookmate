namespace Cookmate.Domain.Entities;

/// <summary>
/// A current promotion ("bonus") for a single SKU at a single store. Shared
/// catalogue data, not user-owned — identity is (<see cref="StoreCode"/>,
/// <see cref="Sku"/>). Refreshed in bulk from the store; expired rows are pruned.
/// Product metadata (name, image, pack size) lives on the matching
/// <see cref="GroceryProduct"/>; this row only carries the promo-specific fields.
/// Prices are nullable because multi-buy mechanisms ("2 voor 0.99") have no single
/// before/after price — <see cref="DiscountLabel"/> is the reliable display value then.
/// </summary>
public class Promotion : BaseAuditableEntity
{
    public string StoreCode { get; private set; } = string.Empty;

    public string Sku { get; private set; } = string.Empty;

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
        string? discountLabel,
        decimal? originalPrice,
        decimal? promoPrice,
        string? currency,
        DateOnly? validFrom,
        DateOnly? validTo)
    {
        DiscountLabel = string.IsNullOrWhiteSpace(discountLabel) ? null : discountLabel.Trim();
        OriginalPrice = originalPrice;
        PromoPrice = promoPrice;
        Currency = string.IsNullOrWhiteSpace(currency) ? null : currency.Trim();
        ValidFrom = validFrom;
        ValidTo = validTo;
        FetchedAtUtc = DateTimeOffset.UtcNow;
    }
}
