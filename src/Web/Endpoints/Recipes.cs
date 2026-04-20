using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Commands.DeleteRecipe;
using Cookmate.Application.Recipes.Commands.DeleteRecipeMedia;
using Cookmate.Application.Recipes.Commands.ImportRecipeFromUrl;
using Cookmate.Application.Recipes.Commands.UpdateRecipe;
using Cookmate.Application.Recipes.Commands.UploadRecipeMedia;
using Cookmate.Application.Recipes.Queries.GetRecipe;
using Cookmate.Application.Recipes.Queries.GetRecipeMediaFile;
using Cookmate.Application.Recipes.Queries.ListRecipes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Cookmate.Web.Endpoints;

public class Recipes : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(ListRecipes);
        groupBuilder.MapGet(GetRecipe, "{id:int}");
        groupBuilder.MapPost(CreateRecipe);
        groupBuilder.MapPost(ImportRecipeFromUrl, "import");
        groupBuilder.MapPut(UpdateRecipe, "{id:int}");
        groupBuilder.MapDelete(DeleteRecipe, "{id:int}");

        groupBuilder.MapPost(UploadRecipeMedia, "{id:int}/media")
            .DisableAntiforgery();
        groupBuilder.MapGet(GetRecipeMediaFile, "{id:int}/media/{mediaId:int}/file");
        groupBuilder.MapDelete(DeleteRecipeMedia, "{id:int}/media/{mediaId:int}");
    }

    [EndpointSummary("List recipes")]
    [EndpointDescription("Returns a lightweight list of recipes. Optional 'search' filters on title and summary; 'tag' filters by exact tag match; 'source' is a substring match on the source URL (host or path); 'maxTimeMinutes' caps total time (recipes with no time always pass).")]
    public static async Task<Ok<IReadOnlyList<RecipeSummaryDto>>> ListRecipes(
        ISender sender,
        string? search,
        string? tag,
        string? source,
        int? maxTimeMinutes)
    {
        var recipes = await sender.Send(new ListRecipesQuery
        {
            Search = search,
            Tag = tag,
            Source = source,
            MaxTimeMinutes = maxTimeMinutes,
        });

        return TypedResults.Ok(recipes);
    }

    [EndpointSummary("Get a recipe by id")]
    [EndpointDescription("Retrieves a recipe with its ingredients, steps, and media. When the 'servings' query parameter is supplied, ingredient amounts are scaled accordingly.")]
    public static async Task<Ok<RecipeDto>> GetRecipe(ISender sender, int id, int? servings)
    {
        var recipe = await sender.Send(new GetRecipeQuery { Id = id, Servings = servings });

        return TypedResults.Ok(recipe);
    }

    [EndpointSummary("Create a new recipe")]
    [EndpointDescription("Creates a new recipe with its ingredients and steps, and returns the generated identifier.")]
    public static async Task<Created<int>> CreateRecipe(ISender sender, CreateRecipeCommand command)
    {
        var id = await sender.Send(command);

        return TypedResults.Created($"/{nameof(Recipes)}/{id}", id);
    }

    [EndpointSummary("Import a recipe from a URL")]
    [EndpointDescription("Scrapes the page at the supplied URL for schema.org Recipe JSON-LD, persists a draft recipe with the parsed data, downloads the cover image, and returns the new recipe id. The frontend should send the user straight to the edit form.")]
    public static async Task<Created<int>> ImportRecipeFromUrl(ISender sender, ImportRecipeFromUrlCommand command)
    {
        var id = await sender.Send(command);

        return TypedResults.Created($"/api/Recipes/{id}", id);
    }

    [EndpointSummary("Update an existing recipe")]
    [EndpointDescription("Replaces the recipe's metadata, ingredients, and steps. The route id must match the id in the payload.")]
    public static async Task<Results<NoContent, BadRequest>> UpdateRecipe(ISender sender, int id, UpdateRecipeCommand command)
    {
        if (id != command.Id) return TypedResults.BadRequest();

        await sender.Send(command);

        return TypedResults.NoContent();
    }

    [EndpointSummary("Delete a recipe")]
    [EndpointDescription("Deletes the recipe with the specified id, cascading its ingredients, steps, and media.")]
    public static async Task<NoContent> DeleteRecipe(ISender sender, int id)
    {
        await sender.Send(new DeleteRecipeCommand(id));

        return TypedResults.NoContent();
    }

    [EndpointSummary("Upload a photo or video for a recipe")]
    [EndpointDescription("Accepts multipart/form-data with a 'file' field. Allowed types: image/jpeg, image/png, image/webp, video/mp4, video/webm. Max size 50 MB.")]
    public static async Task<Created<int>> UploadRecipeMedia(ISender sender, int id, IFormFile file, [FromForm] string? caption)
    {
        await using var content = file.OpenReadStream();

        var mediaId = await sender.Send(new UploadRecipeMediaCommand
        {
            RecipeId = id,
            Content = content,
            ContentType = file.ContentType,
            LengthBytes = file.Length,
            Caption = caption
        });

        return TypedResults.Created($"/api/Recipes/{id}/media/{mediaId}/file", mediaId);
    }

    [EndpointSummary("Stream a recipe's media file")]
    [EndpointDescription("Returns the stored photo or video with its original Content-Type. Requires authentication.")]
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetRecipeMediaFile(ISender sender, IFileStorage storage, int id, int mediaId, CancellationToken cancellationToken)
    {
        var info = await sender.Send(new GetRecipeMediaFileQuery(id, mediaId), cancellationToken);

        var stream = await storage.OpenReadAsync(info.StorageKey, cancellationToken);

        return TypedResults.Stream(stream, info.ContentType);
    }

    [EndpointSummary("Delete a recipe's media file")]
    [EndpointDescription("Removes the media entry and its underlying file.")]
    public static async Task<NoContent> DeleteRecipeMedia(ISender sender, int id, int mediaId)
    {
        await sender.Send(new DeleteRecipeMediaCommand(id, mediaId));

        return TypedResults.NoContent();
    }
}
