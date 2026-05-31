using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Queries.ListGroceryStores;

public record ListGroceryStoresQuery : IRequest<IReadOnlyList<GroceryStoreDto>>;

public class ListGroceryStoresQueryHandler : IRequestHandler<ListGroceryStoresQuery, IReadOnlyList<GroceryStoreDto>>
{
    private readonly IGroceryStoreRegistry _registry;

    public ListGroceryStoresQueryHandler(IGroceryStoreRegistry registry)
    {
        _registry = registry;
    }

    public Task<IReadOnlyList<GroceryStoreDto>> Handle(ListGroceryStoresQuery request, CancellationToken cancellationToken)
    {
        IReadOnlyList<GroceryStoreDto> stores = _registry.All()
            .Select(s => new GroceryStoreDto { Code = s.Code, DisplayName = s.DisplayName })
            .ToList();

        return Task.FromResult(stores);
    }
}
