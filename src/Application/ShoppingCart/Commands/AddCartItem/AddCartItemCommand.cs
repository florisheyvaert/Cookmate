using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.ShoppingCart.Common;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.AddCartItem;

/// <summary>
/// Adds one item to the shopping cart — either a real store product (when <see cref="Sku"/>
/// and <see cref="StoreCode"/> are set, e.g. from a promotion) or free text for something not
/// in the catalogue. Re-adding the same product or free-text name bumps its quantity instead
/// of creating a duplicate.
/// </summary>
public record AddCartItemCommand : IRequest<int>
{
    public string DisplayName { get; init; } = string.Empty;

    public string? StoreCode { get; init; }

    public string? Sku { get; init; }

    public string? ImageUrl { get; init; }

    public int Quantity { get; init; } = 1;

    public CartItemSource Source { get; init; } = CartItemSource.Manual;
}

public class AddCartItemCommandHandler : IRequestHandler<AddCartItemCommand, int>
{
    private readonly IApplicationDbContext _context;

    public AddCartItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(AddCartItemCommand request, CancellationToken cancellationToken)
    {
        var quantity = request.Quantity < 1 ? 1 : request.Quantity;
        var linked = !string.IsNullOrWhiteSpace(request.StoreCode) && !string.IsNullOrWhiteSpace(request.Sku);

        var incoming = linked
            ? ShoppingCartItem.Product(request.StoreCode!, request.Sku!, request.DisplayName, request.ImageUrl, quantity, request.Source)
            : ShoppingCartItem.FreeText(request.DisplayName, quantity, request.Source);

        var tracked = await _context.ShoppingCartItems.ToListAsync(cancellationToken);
        var result = CartUpserter.Upsert(_context, tracked, incoming);

        await _context.SaveChangesAsync(cancellationToken);
        return result.Id;
    }
}
