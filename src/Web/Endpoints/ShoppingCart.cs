using Cookmate.Application.ShoppingCart.Commands.AddCartItem;
using Cookmate.Application.ShoppingCart.Commands.AddPeriodToCart;
using Cookmate.Application.ShoppingCart.Commands.ClearCart;
using Cookmate.Application.ShoppingCart.Commands.LinkCartItem;
using Cookmate.Application.ShoppingCart.Commands.RemoveCartItem;
using Cookmate.Application.ShoppingCart.Commands.SetCartItemQuantity;
using Cookmate.Application.ShoppingCart.Queries.GetCart;
using Cookmate.Application.ShoppingCart.Queries.GetCartDishes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

/// <summary>
/// The household's shopping cart: add real products or free text, adjust quantities, pull in a
/// whole week from the meal plan, see which dishes the cart's ingredients unlock, and clear it.
/// The store deeplink is built from the cart's linked items via the existing Shopping endpoint.
/// </summary>
public class ShoppingCart : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetCart, "");
        groupBuilder.MapGet(GetCartDishes, "dishes");
        groupBuilder.MapPost(AddCartItem, "items");
        groupBuilder.MapPut(SetCartItemQuantity, "items/{id:int}/quantity");
        groupBuilder.MapPost(LinkCartItem, "items/{id:int}/link");
        groupBuilder.MapDelete(RemoveCartItem, "items/{id:int}");
        groupBuilder.MapPost(AddPeriodToCart, "period");
        groupBuilder.MapDelete(ClearCart, "");
    }

    [EndpointSummary("The shopping cart")]
    public static async Task<Ok<CartDto>> GetCart(ISender sender)
    {
        var cart = await sender.Send(new GetCartQuery());
        return TypedResults.Ok(cart);
    }

    [EndpointSummary("Dishes you can make from what's in the cart")]
    [EndpointDescription("Ranks suggestion-pool dishes by how many of their non-staple ingredients are already in the cart; ties broken by fewest still to buy.")]
    public static async Task<Ok<IReadOnlyList<CartDishDto>>> GetCartDishes(ISender sender, int? limit)
    {
        var dishes = await sender.Send(new GetCartDishesQuery { Limit = limit ?? 50 });
        return TypedResults.Ok(dishes);
    }

    [EndpointSummary("Add an item (real product or free text)")]
    public static async Task<Ok<int>> AddCartItem(ISender sender, [FromBody] AddCartItemCommand command)
    {
        var id = await sender.Send(command);
        return TypedResults.Ok(id);
    }

    [EndpointSummary("Set a line's quantity (0 removes it)")]
    public static async Task<NoContent> SetCartItemQuantity(ISender sender, int id, [FromBody] SetQuantityBody body)
    {
        await sender.Send(new SetCartItemQuantityCommand { Id = id, Quantity = body.Quantity });
        return TypedResults.NoContent();
    }

    [EndpointSummary("Link a free-text line to a real store product")]
    public static async Task<NoContent> LinkCartItem(ISender sender, int id, [FromBody] LinkCartItemBody body)
    {
        await sender.Send(new LinkCartItemCommand
        {
            Id = id,
            StoreCode = body.StoreCode,
            Sku = body.Sku,
            ProductName = body.ProductName,
            ImageUrl = body.ImageUrl,
        });
        return TypedResults.NoContent();
    }

    [EndpointSummary("Remove a line")]
    public static async Task<NoContent> RemoveCartItem(ISender sender, int id)
    {
        await sender.Send(new RemoveCartItemCommand(id));
        return TypedResults.NoContent();
    }

    [EndpointSummary("Add everything the meal plan needs over a date range")]
    public static async Task<Ok<int>> AddPeriodToCart(ISender sender, [FromBody] AddPeriodToCartCommand command)
    {
        var added = await sender.Send(command);
        return TypedResults.Ok(added);
    }

    [EndpointSummary("Empty the cart")]
    public static async Task<NoContent> ClearCart(ISender sender)
    {
        await sender.Send(new ClearCartCommand());
        return TypedResults.NoContent();
    }
}

public record SetQuantityBody(int Quantity);

public record LinkCartItemBody(string StoreCode, string Sku, string? ProductName, string? ImageUrl);
