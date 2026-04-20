using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Application.Recipes.Queries.ListRecipes;

namespace Cookmate.Application.FunctionalTests.Recipes.Queries;

using static TestApp;

public class ListRecipesTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        await Should.ThrowAsync<UnauthorizedAccessException>(() => SendAsync(new ListRecipesQuery()));
    }

    [Test]
    public async Task ShouldReturnEmptyListWhenNoRecipes()
    {
        await RunAsDefaultUserAsync();

        var result = await SendAsync(new ListRecipesQuery());

        result.ShouldBeEmpty();
    }

    [Test]
    public async Task ShouldReturnSummariesOrderedByTitle()
    {
        await RunAsDefaultUserAsync();

        await SendAsync(new CreateRecipeCommand { Title = "Zucchini soup", BaseServings = 2 });
        await SendAsync(new CreateRecipeCommand { Title = "Apple pie", BaseServings = 6 });
        await SendAsync(new CreateRecipeCommand { Title = "Moussaka", BaseServings = 4, Summary = "Greek classic." });

        var result = await SendAsync(new ListRecipesQuery());

        result.Count.ShouldBe(3);
        result.Select(r => r.Title).ShouldBe(["Apple pie", "Moussaka", "Zucchini soup"]);
        result[1].Summary.ShouldBe("Greek classic.");
        result[1].BaseServings.ShouldBe(4);
    }
}
