using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Queries.BrowseMealSuggestions;
using Cookmate.Application.MealSuggestions.Queries.GetMealSuggestion;
using Cookmate.Application.MealSuggestions.Queries.GetMealSuggestionImage;
using Cookmate.Application.MealSuggestions.Queries.GetSuggestionFacets;
using Cookmate.Application.MealSuggestions.Queries.GetWeeklyIdeas;
using Cookmate.Application.MealSuggestions.Queries.GetWeeklyProposal;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Cookmate.Web.Endpoints;

public class MealSuggestions : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(Browse);
        groupBuilder.MapGet(Facets, "facets");
        groupBuilder.MapGet(WeeklyIdeas, "weekly-ideas");
        groupBuilder.MapGet(Weekly, "weekly");
        groupBuilder.MapGet(Get, "{id:int}");
        groupBuilder.MapGet(GetImage, "{id:int}/image");
    }

    [EndpointSummary("Get a suggestion by id")]
    [EndpointDescription("Returns the full scraped suggestion — ingredients and steps included — for viewing inside the app.")]
    public static async Task<Ok<MealSuggestionDetailDto>> Get(ISender sender, int id)
    {
        var suggestion = await sender.Send(new GetMealSuggestionQuery(id));

        return TypedResults.Ok(suggestion);
    }

    [EndpointSummary("Browse harvested meal suggestions")]
    [EndpointDescription("Returns the suggestion pool. Optional 'search' filters on title/summary; 'tag' is an exact tag match; 'sourceId' filters to one source; 'maxTimeMinutes' caps total time (suggestions with no time always pass).")]
    public static async Task<Ok<IReadOnlyList<MealSuggestionDto>>> Browse(
        ISender sender,
        string? search,
        string? tag,
        int? sourceId,
        int? maxTimeMinutes,
        string? sort,
        int? page,
        int? pageSize)
    {
        var suggestions = await sender.Send(new BrowseMealSuggestionsQuery
        {
            Search = search,
            Tag = tag,
            SourceId = sourceId,
            MaxTimeMinutes = maxTimeMinutes,
            Sort = sort,
            Page = page ?? 1,
            PageSize = pageSize ?? 24,
        });

        return TypedResults.Ok(suggestions);
    }

    [EndpointSummary("Tag counts + total for the suggestion pool")]
    [EndpointDescription("Returns the full tag histogram and total under the given filters (excluding the tag itself), so the browse page can show complete tag counts independent of paging.")]
    public static async Task<Ok<SuggestionFacetsDto>> Facets(
        ISender sender,
        string? search,
        int? sourceId,
        int? maxTimeMinutes)
    {
        var facets = await sender.Send(new GetSuggestionFacetsQuery
        {
            Search = search,
            SourceId = sourceId,
            MaxTimeMinutes = maxTimeMinutes,
        });

        return TypedResults.Ok(facets);
    }

    [EndpointSummary("This week's main-course ideas")]
    [EndpointDescription("Returns up to ~50 main-course suggestions for the current week, shuffled with a week-based seed so the set and order are stable within the week but change weekly. This is the catalog-style 'ideas' offering.")]
    public static async Task<Ok<IReadOnlyList<MealSuggestionDto>>> WeeklyIdeas(ISender sender, int? count)
    {
        var ideas = await sender.Send(new GetWeeklyIdeasQuery { Count = count ?? 50 });

        return TypedResults.Ok(ideas);
    }

    [EndpointSummary("This week's suggested dishes")]
    [EndpointDescription("Returns one suggested dish per weekday (Mon–Sun). Selection is stable within a week, so it doesn't reshuffle on reload.")]
    public static async Task<Ok<WeeklyProposalDto>> Weekly(ISender sender)
    {
        var proposal = await sender.Send(new GetWeeklyProposalQuery());

        return TypedResults.Ok(proposal);
    }

    [EndpointSummary("Stream a suggestion's cover image")]
    [EndpointDescription("Returns the locally stored cover image downloaded at harvest time. 404 when the suggestion has no image.")]
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetImage(
        ISender sender, IFileStorage storage, int id, CancellationToken cancellationToken)
    {
        var info = await sender.Send(new GetMealSuggestionImageQuery(id), cancellationToken);

        var stream = await storage.OpenReadAsync(info.StorageKey, cancellationToken);

        return TypedResults.Stream(stream, info.ContentType);
    }
}
