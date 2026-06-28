using Cookmate.Application.Promotions.Commands.RefreshPromotions;
using Cookmate.Application.Promotions.Queries.GetPromoDishes;
using Cookmate.Application.Promotions.Queries.GetPromoPeriods;
using Cookmate.Application.Promotions.Queries.GetPromotions;
using Cookmate.Application.Shopping.Commands.SetIngredientProductPreference;
using Cookmate.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

/// <summary>
/// Promotions ("bonus") flow: refresh a store's current promos, browse them, find dishes from
/// the suggestion pool you can make with the selected promos, and confirm a promo↔ingredient
/// match (which the weekly cart then reuses). Planning a dish reuses the existing meal-plan
/// endpoints; building the cart reuses the existing weekly-cart endpoint.
/// </summary>
public class Promotions : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(ListPeriods, "{storeCode}/periods");
        groupBuilder.MapGet(ListPromotions, "{storeCode}");
        groupBuilder.MapGet(GetDishes, "{storeCode}/dishes");
        groupBuilder.MapPost(ConfirmMatch, "match/confirm");

        // Refresh hits the store API and writes the shared cache — admin-gated like the harvest.
        groupBuilder.MapPost(Refresh, "refresh/{storeCode}").RequireAuthorization(Roles.Administrator);
    }

    [EndpointSummary("Available bonus weeks for a store")]
    [EndpointDescription("The distinct cached bonus weeks (oldest first), with the current week flagged — the source for the week filter.")]
    public static async Task<Ok<IReadOnlyList<PromoPeriodDto>>> ListPeriods(ISender sender, string storeCode)
    {
        var periods = await sender.Send(new GetPromoPeriodsQuery { StoreCode = storeCode });
        return TypedResults.Ok(periods);
    }

    [EndpointSummary("Promotions for a store's bonus week")]
    [EndpointDescription("The promotions for one bonus week. Omit validFrom for the current week.")]
    public static async Task<Ok<IReadOnlyList<PromotionDto>>> ListPromotions(
        ISender sender, string storeCode, [FromQuery] DateOnly? validFrom)
    {
        var promos = await sender.Send(new GetPromotionsQuery { StoreCode = storeCode, ValidFrom = validFrom });
        return TypedResults.Ok(promos);
    }

    [EndpointSummary("Dishes you can make from the selected promos")]
    [EndpointDescription("Ranks suggestion-pool dishes by how many of their non-staple ingredients are covered by the selected promo SKUs (or all of the week's promos when none are selected).")]
    public static async Task<Ok<IReadOnlyList<PromoDishDto>>> GetDishes(
        ISender sender, string storeCode, [FromQuery] string[]? skus, [FromQuery] DateOnly? validFrom, int? limit)
    {
        var dishes = await sender.Send(new GetPromoDishesQuery
        {
            StoreCode = storeCode,
            Skus = skus ?? [],
            ValidFrom = validFrom,
            Limit = limit ?? 24,
        });
        return TypedResults.Ok(dishes);
    }

    [EndpointSummary("Confirm a promo ↔ ingredient match")]
    [EndpointDescription("Remembers that an ingredient name maps to a promo product, hardening the match and pre-filling the weekly cart. Reuses the shopping product-preference command.")]
    public static async Task<NoContent> ConfirmMatch(ISender sender, [FromBody] SetIngredientProductPreferenceCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Refresh a store's promotions (admin)")]
    [EndpointDescription("Fetches the store's current bonus assortment and refreshes the local cache. Returns the number of promotions cached.")]
    public static async Task<Ok<int>> Refresh(ISender sender, string storeCode)
    {
        var count = await sender.Send(new RefreshPromotionsCommand { StoreCode = storeCode });
        return TypedResults.Ok(count);
    }
}
