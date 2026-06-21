using Cookmate.Application.MealSuggestions.Commands.CreateSuggestionSource;
using Cookmate.Application.MealSuggestions.Commands.DeleteSuggestionSource;
using Cookmate.Application.MealSuggestions.Commands.HarvestMealSuggestions;
using Cookmate.Application.MealSuggestions.Commands.UpdateHarvestSchedule;
using Cookmate.Application.MealSuggestions.Commands.UpdateSuggestionSource;
using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Application.MealSuggestions.Queries.GetHarvestSchedule;
using Cookmate.Application.MealSuggestions.Queries.ListHarvestRuns;
using Cookmate.Application.MealSuggestions.Queries.ListSuggestionSources;
using Cookmate.Domain.Constants;
using Cookmate.Domain.Enums;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Cookmate.Web.Endpoints;

public class SuggestionSources : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(List);
        groupBuilder.MapGet(ListRuns, "runs");
        groupBuilder.MapGet(ListRunsForSource, "{id:int}/runs");
        groupBuilder.MapGet(GetSchedule, "schedule");
        groupBuilder.MapPut(UpdateSchedule, "schedule").RequireAuthorization(Roles.Administrator);

        groupBuilder.MapPost(Create).RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPut(Update, "{id:int}").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapDelete(Delete, "{id:int}").RequireAuthorization(Roles.Administrator);

        groupBuilder.MapPost(HarvestOne, "{id:int}/harvest").RequireAuthorization(Roles.Administrator);
        groupBuilder.MapPost(HarvestAll, "harvest").RequireAuthorization(Roles.Administrator);
    }

    [EndpointSummary("List suggestion sources")]
    public static async Task<Ok<IReadOnlyList<SuggestionSourceDto>>> List(ISender sender)
    {
        var sources = await sender.Send(new ListSuggestionSourcesQuery());

        return TypedResults.Ok(sources);
    }

    [EndpointSummary("Add a suggestion source")]
    [EndpointDescription("Registers an external site to harvest from. Provide one or more listing/overview URLs for the generic discoverer to crawl.")]
    public static async Task<Created<int>> Create(ISender sender, CreateSuggestionSourceCommand command)
    {
        var id = await sender.Send(command);

        return TypedResults.Created($"/api/SuggestionSources/{id}", id);
    }

    [EndpointSummary("Update a suggestion source")]
    [EndpointDescription("Edits the source: rename, change host, enable/disable, and set listing URLs / per-run cap.")]
    public static async Task<Results<NoContent, BadRequest>> Update(ISender sender, int id, UpdateSuggestionSourceCommand command)
    {
        if (id != command.Id) return TypedResults.BadRequest();

        await sender.Send(command);

        return TypedResults.NoContent();
    }

    [EndpointSummary("Delete a suggestion source")]
    [EndpointDescription("Deletes the source and cascades its harvested suggestions.")]
    public static async Task<NoContent> Delete(ISender sender, int id)
    {
        await sender.Send(new DeleteSuggestionSourceCommand(id));

        return TypedResults.NoContent();
    }

    [EndpointSummary("Harvest one source now")]
    [EndpointDescription("Runs the harvest for a single source on demand (regardless of its enabled flag) and returns the full report — successes and failures — so issues are visible immediately.")]
    public static async Task<Ok<HarvestReport>> HarvestOne(ISender sender, int id)
    {
        var report = await sender.Send(new HarvestMealSuggestionsCommand
        {
            SourceId = id,
            Trigger = HarvestTrigger.Manual,
        });

        return TypedResults.Ok(report);
    }

    [EndpointSummary("Harvest all enabled sources now")]
    public static async Task<Ok<HarvestReport>> HarvestAll(ISender sender)
    {
        var report = await sender.Send(new HarvestMealSuggestionsCommand { Trigger = HarvestTrigger.Manual });

        return TypedResults.Ok(report);
    }

    [EndpointSummary("Recent harvest runs")]
    [EndpointDescription("Returns recent harvest runs (including the weekly auto-runs) with their full per-URL report, for debugging.")]
    public static async Task<Ok<IReadOnlyList<HarvestReport>>> ListRuns(ISender sender, int? take)
    {
        var runs = await sender.Send(new ListHarvestRunsQuery { Take = take ?? 20 });

        return TypedResults.Ok(runs);
    }

    [EndpointSummary("Recent harvest runs for a source")]
    public static async Task<Ok<IReadOnlyList<HarvestReport>>> ListRunsForSource(ISender sender, int id, int? take)
    {
        var runs = await sender.Send(new ListHarvestRunsQuery { SourceId = id, Take = take ?? 20 });

        return TypedResults.Ok(runs);
    }

    [EndpointSummary("Get the automatic-harvest schedule")]
    public static async Task<Ok<HarvestScheduleDto>> GetSchedule(ISender sender)
    {
        var schedule = await sender.Send(new GetHarvestScheduleQuery());

        return TypedResults.Ok(schedule);
    }

    [EndpointSummary("Set the automatic-harvest schedule")]
    [EndpointDescription("Sets whether the weekly harvest runs and on which weekday (0=Sunday…6=Saturday) and local time (HH:mm).")]
    public static async Task<NoContent> UpdateSchedule(ISender sender, UpdateHarvestScheduleCommand command)
    {
        await sender.Send(command);

        return TypedResults.NoContent();
    }
}
