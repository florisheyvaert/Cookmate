using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Application.Promotions.Commands.RefreshPromotions;
using Cookmate.Application.Promotions.Commands.UpdatePromotionSchedule;
using Cookmate.Application.Promotions.Commands.UpdateStorePromotionSetting;
using Cookmate.Application.Promotions.Queries.GetPromoDishes;
using Cookmate.Application.Promotions.Queries.GetPromotions;
using Cookmate.Application.Promotions.Queries.GetPromotionSchedule;
using Cookmate.Application.Promotions.Queries.ListPromotionIntegrations;
using Cookmate.Application.Promotions.Queries.ListPromotionRuns;
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

        groupBuilder.MapGet(ListPromotions, "{storeCode}");
        groupBuilder.MapGet(GetDishes, "{storeCode}/dishes");
        groupBuilder.MapPost(ConfirmMatch, "match/confirm");

        // Managing integrations (refresh, toggle, schedule, history) hits store APIs and writes
        // the shared cache/config — admin-gated like the meal-harvest management.
        groupBuilder.MapGet(ListIntegrations, "integrations").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPut(UpdateSetting, "integrations/{storeCode}").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapGet(GetPromotionSchedule, "schedule").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPut(UpdatePromotionSchedule, "schedule").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapGet(ListPromotionRuns, "runs").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(Refresh, "refresh/{storeCode}").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(RefreshAll, "refresh").RequireAuthorization(Roles.Administrator);
    }

    [EndpointSummary("Current promotions for a store")]
    public static async Task<Ok<IReadOnlyList<PromotionDto>>> ListPromotions(ISender sender, string storeCode)
    {
        var promos = await sender.Send(new GetPromotionsQuery { StoreCode = storeCode });
        return TypedResults.Ok(promos);
    }

    [EndpointSummary("Dishes you can make from the selected promos")]
    [EndpointDescription("Ranks suggestion-pool dishes by how many of their non-staple ingredients are covered by the selected promo SKUs (or all current promos when none are selected).")]
    public static async Task<Ok<IReadOnlyList<PromoDishDto>>> GetDishes(
        ISender sender, string storeCode, [FromQuery] string[]? skus, int? limit)
    {
        var dishes = await sender.Send(new GetPromoDishesQuery
        {
            StoreCode = storeCode,
            Skus = skus ?? [],
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

    [EndpointSummary("Promotion integrations (admin)")]
    [EndpointDescription("Every store Cookmate can pull promotions from, with its enabled toggle, last-refresh telemetry, and cached promo count.")]
    public static async Task<Ok<IReadOnlyList<PromotionIntegrationDto>>> ListIntegrations(ISender sender)
    {
        var integrations = await sender.Send(new ListPromotionIntegrationsQuery());
        return TypedResults.Ok(integrations);
    }

    [EndpointSummary("Turn a store's promotions on or off (admin)")]
    public static async Task<NoContent> UpdateSetting(ISender sender, string storeCode, [FromBody] UpdateStoreSettingRequest body)
    {
        await sender.Send(new UpdateStorePromotionSettingCommand { StoreCode = storeCode, Enabled = body.Enabled });
        return TypedResults.NoContent();
    }

    [EndpointSummary("Automatic promotion-refresh schedule (admin)")]
    public static async Task<Ok<PromotionScheduleDto>> GetPromotionSchedule(ISender sender)
    {
        var schedule = await sender.Send(new GetPromotionScheduleQuery());
        return TypedResults.Ok(schedule);
    }

    [EndpointSummary("Set the automatic promotion-refresh schedule (admin)")]
    public static async Task<NoContent> UpdatePromotionSchedule(ISender sender, [FromBody] UpdatePromotionScheduleCommand command)
    {
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Recent promotion-refresh runs (admin)")]
    public static async Task<Ok<IReadOnlyList<IntegrationRunReport>>> ListPromotionRuns(ISender sender, int? take)
    {
        var runs = await sender.Send(new ListPromotionRunsQuery { Take = take ?? 20 });
        return TypedResults.Ok(runs);
    }

    [EndpointSummary("Refresh a store's promotions (admin)")]
    [EndpointDescription("Fetches the store's current bonus assortment and refreshes the local cache, recording a run in the history. Runs even when the store is switched off.")]
    public static async Task<Ok<IntegrationRunReport>> Refresh(ISender sender, string storeCode)
    {
        var report = await sender.Send(new RefreshPromotionsCommand { StoreCode = storeCode });
        return TypedResults.Ok(report);
    }

    [EndpointSummary("Refresh every enabled store's promotions (admin)")]
    public static async Task<Ok<IntegrationRunReport>> RefreshAll(ISender sender)
    {
        var report = await sender.Send(new RefreshPromotionsCommand());
        return TypedResults.Ok(report);
    }
}

/// <summary>Body for toggling a store's promotions capability.</summary>
public record UpdateStoreSettingRequest(bool Enabled);
