using Cookmate.Domain.ValueObjects;

namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// An optional capability layered on top of <see cref="IGroceryStore"/>: fetch the
/// store's current promotions ("bonus"). A store that supports it implements this
/// alongside <see cref="IGroceryStore"/>; the promotions feature only queries stores
/// that do. Kept separate so the core store contract stays minimal and not every
/// store is forced to expose offers.
/// </summary>
public interface IStorePromotionSource
{
    /// <summary>Store code this matches — mirrors <see cref="IGroceryStore.Code"/>.</summary>
    string Code { get; }

    /// <summary>
    /// The store's current promotions. Best-effort — returns an empty list if the
    /// store is unreachable, the response is malformed, or the API is closed off.
    /// Should not throw.
    /// </summary>
    Task<IReadOnlyList<StorePromotion>> GetPromotionsAsync(CancellationToken cancellationToken);
}

/// <summary>
/// A single promoted product. Prices are nullable because multi-buy mechanisms
/// (e.g. "2 voor 0.99", "1 + 1 gratis") carry no single before/after price — in
/// those cases <see cref="DiscountLabel"/> is the reliable display value.
/// </summary>
public record StorePromotion(
    string Sku,
    string Name,
    string? BrandOrSubtitle,
    Quantity PackSize,
    decimal? OriginalPrice,
    decimal? PromoPrice,
    string? DiscountLabel,
    string? Currency,
    string? ImageUrl,
    string? CanonicalUrl,
    DateOnly? ValidFrom,
    DateOnly? ValidTo);
