using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;
using Cookmate.Application.ShoppingCart.Common;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.AddPeriodToCart;

/// <summary>
/// Pulls everything the meal plan needs over a date range into the cart (the old "weekly cart"
/// flow, now persisted): each remembered-product ingredient becomes a linked line, each
/// not-yet-linked ingredient becomes free text. Staples and "never buy" items are skipped.
/// Re-running merges into existing lines. Returns the number of lines added or bumped.
/// </summary>
public record AddPeriodToCartCommand : IRequest<int>
{
    public string StoreCode { get; init; } = string.Empty;

    public DateOnly From { get; init; }

    public DateOnly To { get; init; }
}

public class AddPeriodToCartCommandHandler : IRequestHandler<AddPeriodToCartCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _stores;

    public AddPeriodToCartCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry stores)
    {
        _context = context;
        _stores = stores;
    }

    public async Task<int> Handle(AddPeriodToCartCommand request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var cart = await WeeklyCartBuilder.BuildAsync(_context, store, request.From, request.To, cancellationToken);

        var tracked = await _context.ShoppingCartItems.ToListAsync(cancellationToken);
        var added = 0;

        // Remembered-product ingredients → linked lines (carry the computed pack count).
        foreach (var item in cart.ToBuy)
        {
            if (item.Sku is null) continue;
            var line = ShoppingCartItem.Product(
                store.Code, item.Sku, item.ProductName ?? item.IngredientName, item.ImageUrl,
                quantity: item.Packs is > 0 ? item.Packs.Value : 1,
                source: CartItemSource.MealPlan);
            CartUpserter.Upsert(_context, tracked, line);
            added++;
        }

        // Not-yet-linked ingredients → free text, so they're still on the list to sort out.
        foreach (var item in cart.Unmatched)
        {
            var line = ShoppingCartItem.FreeText(item.IngredientName, 1, CartItemSource.MealPlan);
            CartUpserter.Upsert(_context, tracked, line);
            added++;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return added;
    }
}
