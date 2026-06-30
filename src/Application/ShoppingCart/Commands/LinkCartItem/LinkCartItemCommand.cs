using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.LinkCartItem;

/// <summary>
/// Points an existing (usually free-text) cart line at a real store product, so it can be
/// deep-linked to the store. The product name/image come from the picked search result.
/// </summary>
public record LinkCartItemCommand : IRequest
{
    public int Id { get; init; }

    public string StoreCode { get; init; } = string.Empty;

    public string Sku { get; init; } = string.Empty;

    public string? ProductName { get; init; }

    public string? ImageUrl { get; init; }
}

public class LinkCartItemCommandHandler : IRequestHandler<LinkCartItemCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _stores;

    public LinkCartItemCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry stores)
    {
        _context = context;
        _stores = stores;
    }

    public async Task Handle(LinkCartItemCommand request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var item = await _context.ShoppingCartItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, item);

        item.LinkProduct(store.Code, request.Sku, request.ProductName, request.ImageUrl);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
