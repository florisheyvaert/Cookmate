using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Queries.BuildDeeplinkFromItems;

/// <summary>
/// Builds the store deeplink from an explicit, already-reviewed set of SKU + quantity items —
/// so the weekly-cart UI can send the final basket after the user's manual edits (moved items,
/// adjusted pack counts, added products).
/// </summary>
public record BuildDeeplinkFromItemsQuery : IRequest<CartDeeplinkDto>
{
    public string StoreCode { get; init; } = string.Empty;

    public IReadOnlyList<DeeplinkItemDto> Items { get; init; } = [];
}

public record DeeplinkItemDto(string Sku, int Quantity);

public record CartDeeplinkDto
{
    public string? Deeplink { get; init; }

    public bool Truncated { get; init; }

    public string StoreCode { get; init; } = string.Empty;

    public string StoreDisplayName { get; init; } = string.Empty;
}

public class BuildDeeplinkFromItemsQueryHandler : IRequestHandler<BuildDeeplinkFromItemsQuery, CartDeeplinkDto>
{
    private readonly IGroceryStoreRegistry _stores;

    public BuildDeeplinkFromItemsQueryHandler(IGroceryStoreRegistry stores)
    {
        _stores = stores;
    }

    public Task<CartDeeplinkDto> Handle(BuildDeeplinkFromItemsQuery request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var (deeplink, truncated) = WeeklyCartBuilder.TryBuildDeeplink(
            store, request.Items.Select(i => new DeeplinkLineItem(i.Sku, i.Quantity)));

        return Task.FromResult(new CartDeeplinkDto
        {
            Deeplink = deeplink,
            Truncated = truncated,
            StoreCode = store.Code,
            StoreDisplayName = store.DisplayName,
        });
    }
}
