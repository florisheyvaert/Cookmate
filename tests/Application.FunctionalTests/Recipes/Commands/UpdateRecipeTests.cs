using Ardalis.GuardClauses;
using Cookmate.Application.Common.Exceptions;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Commands.UpdateRecipe;
using Cookmate.Application.Recipes.Queries.GetRecipe;

namespace Cookmate.Application.FunctionalTests.Recipes.Commands;

using static TestApp;

public class UpdateRecipeTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        await Should.ThrowAsync<UnauthorizedAccessException>(() =>
            SendAsync(new UpdateRecipeCommand { Id = 1, Title = "X", BaseServings = 1 }));
    }

    [Test]
    public async Task ShouldReturnNotFoundForUnknownId()
    {
        await RunAsDefaultUserAsync();

        await Should.ThrowAsync<NotFoundException>(() =>
            SendAsync(new UpdateRecipeCommand { Id = 999_999, Title = "X", BaseServings = 1 }));
    }

    [Test]
    public async Task ShouldRejectInvalidPayload()
    {
        await RunAsDefaultUserAsync();

        var id = await CreateMinimalRecipe();

        await Should.ThrowAsync<ValidationException>(() =>
            SendAsync(new UpdateRecipeCommand { Id = id, Title = "", BaseServings = 1 }));
    }

    [Test]
    public async Task ShouldReplaceMetadataIngredientsAndSteps()
    {
        await RunAsDefaultUserAsync();

        var id = await SendAsync(new CreateRecipeCommand
        {
            Title = "Old title",
            BaseServings = 2,
            Summary = "Old summary",
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "Old ingredient", Amount = 1, Unit = "g" }
            ],
            Steps = ["Old step"]
        });

        await SendAsync(new UpdateRecipeCommand
        {
            Id = id,
            Title = "New title",
            BaseServings = 6,
            Summary = "New summary",
            SourceUrl = "https://example.com/recipe",
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "Flour", Amount = 300, Unit = "g" },
                new CreateRecipeIngredient { Name = "Water", Amount = 180, Unit = "ml" }
            ],
            Steps = ["Mix.", "Knead.", "Bake."]
        });

        var dto = await SendAsync(new GetRecipeQuery { Id = id });

        dto.Title.ShouldBe("New title");
        dto.BaseServings.ShouldBe(6);
        dto.Summary.ShouldBe("New summary");
        dto.SourceUrl.ShouldBe("https://example.com/recipe");

        dto.Ingredients.Select(i => i.Name).ShouldBe(["Flour", "Water"]);
        dto.Steps.Select(s => s.Instruction).ShouldBe(["Mix.", "Knead.", "Bake."]);
    }

    private static Task<int> CreateMinimalRecipe() => SendAsync(new CreateRecipeCommand
    {
        Title = "Seed",
        BaseServings = 2
    });
}
