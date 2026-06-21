namespace Cookmate.Application.Shopping.Common;

/// <summary>The weekly shopping cart: ingredients aggregated across the planned meals in a
/// date range, split into what to buy, what's probably in stock, and what isn't linked yet.</summary>
public record WeeklyCartDto
{
    public string StoreCode { get; init; } = string.Empty;

    public string StoreDisplayName { get; init; } = string.Empty;

    /// <summary>Non-staple ingredients with a remembered product — ready to buy (carry a product + pack count).</summary>
    public IReadOnlyList<CartItemDto> ToBuy { get; init; } = [];

    /// <summary>Pantry staples — likely already in stock (may carry a product if one was linked).</summary>
    public IReadOnlyList<CartItemDto> ProbablyHave { get; init; } = [];

    /// <summary>Non-staple ingredients with no remembered product yet — need a manual search/link or skip.</summary>
    public IReadOnlyList<CartItemDto> Unmatched { get; init; } = [];

    /// <summary>Ready-made deeplink for the current ToBuy set (the client rebuilds it after edits).</summary>
    public string? Deeplink { get; init; }

    public bool Truncated { get; init; }
}

/// <summary>One aggregated ingredient line, optionally resolved to a store product.</summary>
public record CartItemDto
{
    public string IngredientName { get; init; } = string.Empty;

    /// <summary>Total needed amount across the range, in the family base unit (g / ml / st) when known.</summary>
    public decimal Amount { get; init; }

    public string Unit { get; init; } = string.Empty;

    public IReadOnlyList<string> Meals { get; init; } = [];

    // Product (set when a preference exists for this ingredient name + store).
    public string? Sku { get; init; }

    public string? ProductName { get; init; }

    public string? ImageUrl { get; init; }

    public int? Packs { get; init; }

    public decimal? PackSizeAmount { get; init; }

    public string? PackSizeUnit { get; init; }
}
