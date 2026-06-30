using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Application.Promotions.Commands.RefreshPromotions;
using Cookmate.Application.Promotions.Commands.UpdatePromotionSchedule;
using Cookmate.Application.Promotions.Commands.UpdateStorePromotionSetting;
using Cookmate.Application.Promotions.Queries.GetPromoPeriods;
using Cookmate.Application.Promotions.Queries.GetPromotions;
using Cookmate.Application.Promotions.Queries.GetPromotionSchedule;
using Cookmate.Application.Promotions.Queries.ListPromotionIntegrations;
using Cookmate.Application.Promotions.Queries.ListPromotionRuns;
using Cookmate.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

/// <summary>
/// Promotions ("bonus") flow: refresh a store's current promos and browse them (week filter +
/// group drill-down). Adding promos to the cart and "what can I make" both live on the cart.
/// </summary>
public class Promotions : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(ListPeriods, "{storeCode}/periods");
        groupBuilder.MapGet(ListPromotions, "{storeCode}");

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

    [EndpointSummary("Available bonus weeks for a store")]
    [EndpointDescription("The distinct cached bonus weeks (oldest first), with the current week flagged — the source for the week filter.")]
    public static async Task<Ok<IReadOnlyList<PromoPeriodDto>>> ListPeriods(ISender sender, string storeCode)
    {
        var periods = await sender.Send(new GetPromoPeriodsQuery { StoreCode = storeCode });
        return TypedResults.Ok(periods);
    }

    [EndpointSummary("Promotions for a store's bonus week")]
    [EndpointDescription("The promotions for one bonus week (group tiles + standalone). Omit validFrom for the current week. Pass groupSku to drill into a group's member products.")]
    public static async Task<Ok<IReadOnlyList<PromotionDto>>> ListPromotions(
        ISender sender, string storeCode, [FromQuery] DateOnly? validFrom, [FromQuery] string? groupSku)
    {
        var promos = await sender.Send(new GetPromotionsQuery { StoreCode = storeCode, ValidFrom = validFrom, GroupSku = groupSku });
        return TypedResults.Ok(promos);
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
