using Cookmate.Application.Shopping.Commands.LinkIngredientToProduct;
using Cookmate.Application.Shopping.Commands.LinkIngredientToProductByUrl;
using Cookmate.Application.Shopping.Commands.UnlinkIngredient;
using Cookmate.Application.Shopping.Common;
using Cookmate.Application.Shopping.Queries.BuildRecipeShoppingDeeplink;
using Cookmate.Application.Shopping.Queries.BuildShoppingListDeeplink;
using Cookmate.Application.Shopping.Queries.ListGroceryStores;
using Cookmate.Application.Shopping.Queries.SearchGroceryProducts;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

public class Shopping : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(ListStores, "stores");
        groupBuilder.MapGet(SearchProducts, "stores/{code}/search");

        groupBuilder.MapPost(LinkIngredient, "links");
        groupBuilder.MapPost(LinkIngredientByUrl, "links/by-url");
        groupBuilder.MapDelete(UnlinkIngredient, "links/{linkId:int}");

        groupBuilder.MapGet(BuildRecipeDeeplink, "recipes/{recipeId:int}/{storeCode}");
        groupBuilder.MapPost(BuildListDeeplink, "list/{storeCode}");
    }

    [EndpointSummary("List grocery stores")]
    public static async Task<Ok<IReadOnlyList<GroceryStoreDto>>> ListStores(ISender sender)
    {
        var stores = await sender.Send(new ListGroceryStoresQuery());
        return TypedResults.Ok(stores);
    }

    [EndpointSummary("Search a store's product catalogue")]
    [EndpointDescription("Best-effort full-text product search. Returns an empty list when the store is unreachable or rate-limited; the UI should fall back to manual paste-URL.")]
    public static async Task<Ok<IReadOnlyList<GroceryProductCandidateDto>>> SearchProducts(
        ISender sender, string code, string query)
    {
        var results = await sender.Send(new SearchGroceryProductsQuery
        {
            StoreCode = code,
            Query = query ?? string.Empty,
        });
        return TypedResults.Ok(results);
    }

    [EndpointSummary("Link an ingredient to a store's SKU")]
    public static async Task<NoContent> LinkIngredient(ISender sender, [FromBody] LinkIngredientToProductCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Link an ingredient by pasting the product URL")]
    public static async Task<NoContent> LinkIngredientByUrl(ISender sender, [FromBody] LinkIngredientToProductByUrlCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Remove a single ingredient ↔ product link")]
    public static async Task<NoContent> UnlinkIngredient(ISender sender, int linkId)
    {
        await sender.Send(new UnlinkIngredientCommand(linkId));
        return TypedResults.NoContent();
    }

    [EndpointSummary("Build the add-to-cart deeplink for a single recipe")]
    public static async Task<Ok<ShoppingDeeplinkResultDto>> BuildRecipeDeeplink(
        ISender sender, int recipeId, string storeCode, int? servings)
    {
        var result = await sender.Send(new BuildRecipeShoppingDeeplinkQuery
        {
            RecipeId = recipeId,
            Servings = servings,
            StoreCode = storeCode,
        });
        return TypedResults.Ok(result);
    }

    [EndpointSummary("Build a consolidated deeplink across multiple recipes")]
    public static async Task<Ok<ShoppingDeeplinkResultDto>> BuildListDeeplink(
        ISender sender, string storeCode, [FromBody] BuildShoppingListBody body)
    {
        var result = await sender.Send(new BuildShoppingListDeeplinkQuery
        {
            StoreCode = storeCode,
            Selections = body.Selections.Select(s => new RecipeSelection
            {
                RecipeId = s.RecipeId,
                Servings = s.Servings,
            }).ToArray(),
        });
        return TypedResults.Ok(result);
    }
}

public record BuildShoppingListBody
{
    public IReadOnlyList<BuildShoppingListSelection> Selections { get; init; } = [];
}

public record BuildShoppingListSelection
{
    public int RecipeId { get; init; }
    public int? Servings { get; init; }
}
