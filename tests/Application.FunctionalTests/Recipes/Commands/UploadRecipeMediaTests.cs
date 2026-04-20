using Ardalis.GuardClauses;
using Cookmate.Application.Common.Exceptions;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Commands.UploadRecipeMedia;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.FunctionalTests.Recipes.Commands;

using static TestApp;

public class UploadRecipeMediaTests : TestBase
{
    private static MemoryStream FakePng(int bytes = 1024) => new(new byte[bytes]);

    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        using var content = FakePng();

        await Should.ThrowAsync<UnauthorizedAccessException>(() => SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = 1,
            Content = content,
            ContentType = "image/png",
            LengthBytes = content.Length
        }));
    }

    [Test]
    public async Task ShouldReturnNotFoundForUnknownRecipe()
    {
        await RunAsDefaultUserAsync();

        using var content = FakePng();

        await Should.ThrowAsync<NotFoundException>(() => SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = 999_999,
            Content = content,
            ContentType = "image/png",
            LengthBytes = content.Length
        }));
    }

    [Test]
    public async Task ShouldRejectUnsupportedContentType()
    {
        await RunAsDefaultUserAsync();

        var id = await CreateEmptyRecipe();
        using var content = FakePng();

        await Should.ThrowAsync<ValidationException>(() => SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = id,
            Content = content,
            ContentType = "application/pdf",
            LengthBytes = content.Length
        }));
    }

    [Test]
    public async Task ShouldRejectFileOverSizeLimit()
    {
        await RunAsDefaultUserAsync();

        var id = await CreateEmptyRecipe();
        using var content = FakePng(1);

        await Should.ThrowAsync<ValidationException>(() => SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = id,
            Content = content,
            ContentType = "image/png",
            LengthBytes = RecipeMediaRules.MaxBytes + 1
        }));
    }

    [Test]
    public async Task ShouldStoreMediaAndAttachToRecipe()
    {
        await RunAsDefaultUserAsync();

        var recipeId = await CreateEmptyRecipe();
        using var content = FakePng(2048);

        var mediaId = await SendAsync(new UploadRecipeMediaCommand
        {
            RecipeId = recipeId,
            Content = content,
            ContentType = "image/png",
            LengthBytes = content.Length,
            Caption = "Plating shot"
        });

        mediaId.ShouldBeGreaterThan(0);

        var media = await ExecuteAsync(ctx => ctx.Set<RecipeMedia>()
            .FirstOrDefaultAsync(m => m.Id == mediaId));

        media.ShouldNotBeNull();
        media.Type.ShouldBe(MediaType.Photo);
        media.Caption.ShouldBe("Plating shot");
        media.LocalPath.ShouldEndWith(".png");
        media.RecipeId.ShouldBe(recipeId);
    }

    private static Task<int> CreateEmptyRecipe() => SendAsync(new CreateRecipeCommand
    {
        Title = "Recipe for media",
        BaseServings = 2
    });
}
