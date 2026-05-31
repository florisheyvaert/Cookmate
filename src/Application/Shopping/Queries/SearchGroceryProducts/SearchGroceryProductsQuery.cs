using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Queries.SearchGroceryProducts;

public record SearchGroceryProductsQuery : IRequest<IReadOnlyList<GroceryProductCandidateDto>>
{
    public string StoreCode { get; init; } = string.Empty;
    public string Query { get; init; } = string.Empty;
}

public class SearchGroceryProductsQueryHandler
    : IRequestHandler<SearchGroceryProductsQuery, IReadOnlyList<GroceryProductCandidateDto>>
{
    private readonly IGroceryStoreRegistry _registry;

    public SearchGroceryProductsQueryHandler(IGroceryStoreRegistry registry)
    {
        _registry = registry;
    }

    public async Task<IReadOnlyList<GroceryProductCandidateDto>> Handle(
        SearchGroceryProductsQuery request, CancellationToken cancellationToken)
    {
        var store = _registry.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var trimmed = request.Query?.Trim() ?? string.Empty;
        if (trimmed.Length < 2) return Array.Empty<GroceryProductCandidateDto>();

        var candidates = await store.SearchAsync(trimmed, cancellationToken);

        return candidates
            .Select(c => new GroceryProductCandidateDto
            {
                Sku = c.Sku,
                Name = c.Name,
                BrandOrSubtitle = c.BrandOrSubtitle,
                PackSizeAmount = c.PackSize.Amount,
                PackSizeUnit = c.PackSize.Unit,
                UnitPrice = c.UnitPrice,
                Currency = c.Currency,
                ImageUrl = c.ImageUrl,
                CanonicalUrl = c.CanonicalUrl,
            })
            .ToList();
    }
}
