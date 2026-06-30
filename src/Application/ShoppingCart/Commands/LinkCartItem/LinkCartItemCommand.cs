using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Commands.SetIngredientProductPreference;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.LinkCartItem;

/// <summary>
/// Points an existing (usually free-text) cart line at a real store product, so it can be
/// deep-linked to the store. The product name/image come from the picked search result.
/// Also remembers the line's name → product as a preference, so "add a week" auto-links that
/// ingredient next time.
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
    private readonly ISender _sender;

    public LinkCartItemCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry stores, ISender sender)
    {
        _context = context;
        _stores = stores;
        _sender = sender;
    }

    public async Task Handle(LinkCartItemCommand request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var item = await _context.ShoppingCartItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, item);

        // The label the user typed (before LinkProduct renames the line to the product) is the
        // ingredient name we remember the product choice under.
        var ingredientName = item.DisplayName;

        item.LinkProduct(store.Code, request.Sku, request.ProductName, request.ImageUrl);
        await _context.SaveChangesAsync(cancellationToken);

        // Remember name → product so the meal-plan import links it automatically next time.
        await _sender.Send(
            new SetIngredientProductPreferenceCommand { StoreCode = store.Code, IngredientName = ingredientName, Sku = request.Sku },
            cancellationToken);
    }
}
