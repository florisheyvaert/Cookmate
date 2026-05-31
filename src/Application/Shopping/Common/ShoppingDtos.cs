namespace Cookmate.Application.Shopping.Common;

public record GroceryStoreDto
{
    public string Code { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
}

public record GroceryProductCandidateDto
{
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? BrandOrSubtitle { get; init; }
    public decimal PackSizeAmount { get; init; }
    public string PackSizeUnit { get; init; } = string.Empty;
    public decimal? UnitPrice { get; init; }
    public string? Currency { get; init; }
    public string? ImageUrl { get; init; }
    public string? CanonicalUrl { get; init; }
}

public record IngredientStoreLinkDto
{
    /// <summary>Link row id. Used to delete a specific link by id.</summary>
    public int Id { get; init; }
    public string StoreCode { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string? BrandOrSubtitle { get; init; }
    public string? ImageUrl { get; init; }
    public string? CanonicalUrl { get; init; }
    public decimal PackSizeAmount { get; init; }
    public string PackSizeUnit { get; init; } = string.Empty;
    public decimal? UnitPrice { get; init; }
    public string? Currency { get; init; }
    public decimal DefaultPackQuantity { get; init; }
}

public record ShoppingDeeplinkResultDto
{
    public string? Deeplink { get; init; }
    public string StoreCode { get; init; } = string.Empty;
    public string StoreDisplayName { get; init; } = string.Empty;
    public IReadOnlyList<MappedShoppingItemDto> Mapped { get; init; } = [];
    public IReadOnlyList<UnmappedShoppingItemDto> Unmapped { get; init; } = [];
    public bool Truncated { get; init; }
}

public record MappedShoppingItemDto
{
    public int IngredientId { get; init; }
    public int RecipeId { get; init; }
    public string IngredientName { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public int Packs { get; init; }
    public decimal PackSizeAmount { get; init; }
    public string PackSizeUnit { get; init; } = string.Empty;
}

public record UnmappedShoppingItemDto
{
    public int IngredientId { get; init; }
    public int RecipeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Unit { get; init; } = string.Empty;
}
