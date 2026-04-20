using Ardalis.GuardClauses;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Queries.GetRecipe;

namespace Cookmate.Application.FunctionalTests.Recipes.Queries;

using static TestApp;

public class GetRecipeTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        await Should.ThrowAsync<UnauthorizedAccessException>(() =>
            SendAsync(new GetRecipeQuery { Id = 1 }));
    }

    [Test]
    public async Task ShouldReturnNotFoundForUnknownId()
    {
        await RunAsDefaultUserAsync();

        await Should.ThrowAsync<NotFoundException>(() =>
            SendAsync(new GetRecipeQuery { Id = 999_999 }));
    }

    [Test]
    public async Task ShouldReturnRecipeAtBaseServingsWhenNotScaling()
    {
        await RunAsDefaultUserAsync();

        var id = await CreatePastaRecipe();

        var dto = await SendAsync(new GetRecipeQuery { Id = id });

        dto.BaseServings.ShouldBe(4);
        dto.ServedFor.ShouldBe(4);

        var pasta = dto.Ingredients.Single(i => i.Name == "Pasta");
        pasta.Amount.ShouldBe(400m);
        pasta.Unit.ShouldBe("g");
    }

    [Test]
    public async Task ShouldScaleIngredientsWhenServingsSpecified()
    {
        await RunAsDefaultUserAsync();

        var id = await CreatePastaRecipe();

        var dto = await SendAsync(new GetRecipeQuery { Id = id, Servings = 6 });

        dto.BaseServings.ShouldBe(4);
        dto.ServedFor.ShouldBe(6);

        dto.Ingredients.Single(i => i.Name == "Pasta").Amount.ShouldBe(600m);
        dto.Ingredients.Single(i => i.Name == "Olijfolie").Amount.ShouldBe(3m);
    }

    [Test]
    public async Task ShouldOrderIngredientsAndStepsByOrder()
    {
        await RunAsDefaultUserAsync();

        var id = await SendAsync(new CreateRecipeCommand
        {
            Title = "Pasta",
            BaseServings = 2,
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "First", Amount = 1, Unit = "g" },
                new CreateRecipeIngredient { Name = "Second", Amount = 2, Unit = "g" },
                new CreateRecipeIngredient { Name = "Third", Amount = 3, Unit = "g" }
            ],
            Steps = ["First step.", "Second step.", "Third step."]
        });

        var dto = await SendAsync(new GetRecipeQuery { Id = id });

        dto.Ingredients.Select(i => i.Name).ShouldBe(["First", "Second", "Third"]);
        dto.Steps.Select(s => s.Instruction).ShouldBe(["First step.", "Second step.", "Third step."]);
    }

    private static Task<int> CreatePastaRecipe() => SendAsync(new CreateRecipeCommand
    {
        Title = "Pasta",
        BaseServings = 4,
        Ingredients =
        [
            new CreateRecipeIngredient { Name = "Pasta", Amount = 400, Unit = "g" },
            new CreateRecipeIngredient { Name = "Olijfolie", Amount = 2, Unit = "tbsp" }
        ],
        Steps = ["Boil water.", "Cook pasta."]
    });
}
