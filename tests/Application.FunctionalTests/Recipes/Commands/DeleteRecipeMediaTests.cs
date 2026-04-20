using Ardalis.GuardClauses;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Commands.DeleteRecipeMedia;
using Cookmate.Application.Recipes.Commands.UploadRecipeMedia;
using Cookmate.Domain.Entities;

namespace Cookmate.Application.FunctionalTests.Recipes.Commands;

using static TestApp;

public class DeleteRecipeMediaTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        await Should.ThrowAsync<UnauthorizedAccessException>(() =>
            SendAsync(new DeleteRecipeMediaCommand(1, 1)));
    }

    [Test]
    public async Task ShouldReturnNotFoundWhenRecipeMissing()
    {
        await RunAsDefaultUserAsync();

        await Should.ThrowAsync<NotFoundException>(() =>
            SendAsync(new DeleteRecipeMediaCommand(999_999, 1)));
    }

    [Test]
    public async Task ShouldReturnNotFoundWhenMediaBelongsToDifferentRecipe()
    {
        await RunAsDefaultUserAsync();

        var recipeA = await SendAsync(new CreateRecipeCommand { Title = "A", BaseServings = 2 });
        var recipeB = await SendAsync(new CreateRecipeCommand { Title = "B", BaseServings = 2 });

        using var content = new MemoryStream(new byte[1024]);
        var mediaInA = await SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = recipeA,
            Content = content,
            ContentType = "image/png",
            LengthBytes = content.Length
        });

        await Should.ThrowAsync<NotFoundException>(() =>
            SendAsync(new DeleteRecipeMediaCommand(recipeB, mediaInA)));
    }

    [Test]
    public async Task ShouldRemoveMediaRow()
    {
        await RunAsDefaultUserAsync();

        var recipeId = await SendAsync(new CreateRecipeCommand { Title = "R", BaseServings = 2 });

        using var content = new MemoryStream(new byte[512]);
        var mediaId = await SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = recipeId,
            Content = content,
            ContentType = "image/jpeg",
            LengthBytes = content.Length
        });

        (await CountAsync<RecipeMedia>()).ShouldBe(1);

        await SendAsync(new DeleteRecipeMediaCommand(recipeId, mediaId));

        (await CountAsync<RecipeMedia>()).ShouldBe(0);
    }
}
