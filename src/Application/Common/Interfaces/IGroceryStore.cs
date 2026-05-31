using Cookmate.Domain.ValueObjects;

namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// A grocery store that Cookmate can route a shopping list to. Each store knows
/// (a) how to search its catalogue (best-effort, no auth), (b) how to build the
/// "send to my list/cart" deeplink, and (c) how to extract a SKU from a product
/// URL the user pasted in.
/// </summary>
public interface IGroceryStore
{
    /// <summary>Stable identifier — "ah", "delhaize", "lidl", "jumbo".</summary>
    string Code { get; }

    /// <summary>Human-readable name shown in the UI.</summary>
    string DisplayName { get; }

    /// <summary>
    /// Search the store's catalogue. Best-effort — returns an empty list if the
    /// store is unreachable, the response is malformed, or the API is closed.
    /// Should not throw.
    /// </summary>
    Task<IReadOnlyList<GroceryProductCandidate>> SearchAsync(string query, CancellationToken cancellationToken);

    /// <summary>
    /// Fetch a single product by its SKU. Used to enrich pasted-URL links
    /// (which only carry the SKU). Returns <c>null</c> when the SKU isn't
    /// found or the call fails — caller falls back to a stub.
    /// </summary>
    Task<GroceryProductCandidate?> FindBySkuAsync(string sku, CancellationToken cancellationToken);

    /// <summary>
    /// Build an "add to list/cart" URL the user can open in the store's web
    /// or app. Pure — no I/O. Throws on empty input or oversized output.
    /// </summary>
    GroceryDeeplink BuildAddToListDeeplink(IReadOnlyList<DeeplinkLineItem> items);

    /// <summary>
    /// Best-effort SKU extraction from a product page URL. Returns false when
    /// the URL doesn't match the store's product URL pattern.
    /// </summary>
    bool TryParseProductUrl(string url, out string sku);
}

public record GroceryProductCandidate(
    string Sku,
    string Name,
    string? BrandOrSubtitle,
    Quantity PackSize,
    decimal? UnitPrice,
    string? Currency,
    string? ImageUrl,
    string? CanonicalUrl);

public record DeeplinkLineItem(string Sku, int Quantity);

public record GroceryDeeplink(Uri Url, bool Truncated);
