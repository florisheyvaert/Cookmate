using Cookmate.Application.MealPlanning.Commands.CreateMealEntry;
using Cookmate.Application.MealPlanning.Commands.DeleteMealEntry;
using Cookmate.Application.MealPlanning.Commands.UpdateMealEntry;
using Cookmate.Application.MealPlanning.Queries.GetMealEntries;
using Cookmate.Application.MealPlanning.Queries.GetMealTextSuggestions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

public class MealPlan : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(ListEntries);
        groupBuilder.MapGet(TextSuggestions, "suggestions");
        groupBuilder.MapPost(CreateEntry);
        groupBuilder.MapPut(UpdateEntry, "{id:int}");
        groupBuilder.MapDelete(DeleteEntry, "{id:int}");
    }

    [EndpointSummary("List meal entries in a date range")]
    public static async Task<Ok<IReadOnlyList<MealEntryDto>>> ListEntries(
        ISender sender, DateOnly from, DateOnly to)
    {
        var entries = await sender.Send(new GetMealEntriesQuery { From = from, To = to });
        return TypedResults.Ok(entries);
    }

    [EndpointSummary("Suggest previously-used free-text meals")]
    public static async Task<Ok<IReadOnlyList<string>>> TextSuggestions(ISender sender, string? query)
    {
        var suggestions = await sender.Send(new GetMealTextSuggestionsQuery { Query = query });
        return TypedResults.Ok(suggestions);
    }

    [EndpointSummary("Add a meal entry to a day")]
    public static async Task<Created<int>> CreateEntry(ISender sender, [FromBody] CreateMealEntryCommand command)
    {
        var id = await sender.Send(command);
        return TypedResults.Created($"/api/MealPlan/{id}", id);
    }

    [EndpointSummary("Update a meal entry")]
    public static async Task<Results<NoContent, BadRequest>> UpdateEntry(ISender sender, int id, [FromBody] UpdateMealEntryCommand command)
    {
        if (id != command.Id) return TypedResults.BadRequest();

        await sender.Send(command);
        return TypedResults.NoContent();
    }

    [EndpointSummary("Delete a meal entry")]
    public static async Task<NoContent> DeleteEntry(ISender sender, int id)
    {
        await sender.Send(new DeleteMealEntryCommand(id));
        return TypedResults.NoContent();
    }
}
