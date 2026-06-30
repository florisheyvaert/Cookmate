using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;

namespace Cookmate.Application.ShoppingCart.Common;

/// <summary>
/// Adds an item to the cart, merging into an existing line when it's the same thing: a linked
/// product dedupes on (store, SKU), free text on its normalised name. Operates on an
/// already-loaded, tracked list so a bulk add (e.g. a whole week) is one round-trip.
/// </summary>
internal static class CartUpserter
{
    public static ShoppingCartItem Upsert(IApplicationDbContext context, List<ShoppingCartItem> tracked, ShoppingCartItem incoming)
    {
        ShoppingCartItem? existing = incoming.IsLinked
            ? tracked.FirstOrDefault(i => i.StoreCode == incoming.StoreCode && i.Sku == incoming.Sku)
            : tracked.FirstOrDefault(i => !i.IsLinked && i.NormalizedName == incoming.NormalizedName);

        if (existing is not null)
        {
            existing.Add(incoming.Quantity);
            return existing;
        }

        context.ShoppingCartItems.Add(incoming);
        tracked.Add(incoming);
        return incoming;
    }
}
