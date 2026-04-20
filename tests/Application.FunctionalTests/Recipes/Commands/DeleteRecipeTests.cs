using Ardalis.GuardClauses;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Commands.DeleteRecipe;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.FunctionalTests.Recipes.Commands;

using static TestApp;

public class DeleteRecipeTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        await Should.ThrowAsync<UnauthorizedAccessException>(() =>
            SendAsync(new DeleteRecipeCommand(1)));
    }

    [Test]
    public async Task ShouldReturnNotFoundForUnknownId()
    {
        await RunAsDefaultUserAsync();

        await Should.ThrowAsync<NotFoundException>(() =>
            SendAsync(new DeleteRecipeCommand(999_999)));
    }

    [Test]
    public async Task ShouldDeleteRecipeAndCascadeChildren()
    {
        await RunAsDefaultUserAsync();

        var id = await SendAsync(new CreateRecipeCommand
        {
            Title = "To be deleted",
            BaseServings = 2,
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "Flour", Amount = 200, Unit = "g" }
            ],
            Steps = ["Mix it."]
        });

        await SendAsync(new DeleteRecipeCommand(id));

        var recipeCount = await ExecuteAsync(ctx => ctx.Recipes.CountAsync(r => r.Id == id));
        recipeCount.ShouldBe(0);

        (await CountAsync<Ingredient>()).ShouldBe(0);
        (await CountAsync<RecipeStep>()).ShouldBe(0);
    }
}
