using Cookmate.Application.Shopping.Commands.AddIgnoredIngredient;
using Cookmate.Application.Shopping.Commands.ClearIngredientProductPreference;
using Cookmate.Application.Shopping.Commands.LinkIngredientToProduct;
using Cookmate.Application.Shopping.Commands.LinkIngredientToProductByUrl;
using Cookmate.Application.Shopping.Commands.RemoveIgnoredIngredient;
using Cookmate.Application.Shopping.Commands.SetIngredientProductPreference;
using Cookmate.Application.Shopping.Commands.UnlinkIngredient;
using Cookmate.Application.Shopping.Common;
using Cookmate.Application.Shopping.Queries.BuildDeeplinkFromItems;
using Cookmate.Application.Shopping.Queries.ListIgnoredIngredients;
using Cookmate.Application.Shopping.Queries.BuildRecipeShoppingDeeplink;
using Cookmate.Application.Shopping.Queries.BuildShoppingListDeeplink;
using Cookmate.Application.Shopping.Queries.GetWeeklyCart;
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

        // Weekly cart (from the meal plan) + name→product preferences.
        groupBuilder.MapGet(GetWeeklyCart, "cart/{storeCode}");
        groupBuilder.MapPost(SetPreference, "preferences");
        groupBuilder.MapDelete(ClearPreference, "preferences");
        groupBuilder.MapPost(BuildDeeplink, "deeplink");

        groupBuilder.MapGet(ListIgnored, "ignored");
        groupBuilder.MapPost(AddIgnored, "ignored");
        groupBuilder.MapDelete(RemoveIgnored, "ignored");
    }

    [EndpointSummary("Build the weekly shopping cart from the meal plan")]
    [EndpointDescription("Aggregates the ingredients of every meal planned in [from, to] (recipes scaled by servings + planned suggestions), sums needed amounts before computing pack counts, and splits into to-buy / probably-in-stock / unmatched.")]
    public static async Task<Ok<WeeklyCartDto>> GetWeeklyCart(ISender sender, string storeCode, DateOnly from, DateOnly to)
    {
        var cart = await sender.Send(new GetWeeklyCartQuery { StoreCode = storeCode, From = from, To = to });
        return TypedResults.Ok(cart);
    }

    [EndpointSummary("Remember the product for an ingredient name")]
    public static async Task<NoContent> SetPreference(ISender sender, [FromBody] SetIngredientProductPreferenceCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Forget the remembered product for an ingredient name")]
    public static async Task<NoContent> ClearPreference(ISender sender, string storeCode, string ingredientName)
    {
        await sender.Send(new ClearIngredientProductPreferenceCommand { StoreCode = storeCode, IngredientName = ingredientName });
        return TypedResults.NoContent();
    }

    [EndpointSummary("Build a deeplink from an explicit reviewed basket")]
    public static async Task<Ok<CartDeeplinkDto>> BuildDeeplink(ISender sender, [FromBody] BuildDeeplinkFromItemsQuery query)
    {
        var result = await sender.Send(query);
        return TypedResults.Ok(result);
    }

    [EndpointSummary("List the household's never-buy ingredients")]
    public static async Task<Ok<IReadOnlyList<string>>> ListIgnored(ISender sender)
    {
        var ignored = await sender.Send(new ListIgnoredIngredientsQuery());
        return TypedResults.Ok(ignored);
    }

    [EndpointSummary("Never buy an ingredient")]
    public static async Task<NoContent> AddIgnored(ISender sender, [FromBody] AddIgnoredIngredientCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Stop ignoring an ingredient")]
    public static async Task<NoContent> RemoveIgnored(ISender sender, string ingredientName)
    {
        await sender.Send(new RemoveIgnoredIngredientCommand { IngredientName = ingredientName });
        return TypedResults.NoContent();
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
