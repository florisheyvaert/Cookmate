using Cookmate.Application.Common.Exceptions;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.FunctionalTests.Recipes.Commands;

using static TestApp;

public class CreateRecipeTests : TestBase
{
    [Test]
    public async Task ShouldRequireAuthenticatedUser()
    {
        var command = new CreateRecipeCommand { Title = "Pasta", BaseServings = 4 };

        await Should.ThrowAsync<UnauthorizedAccessException>(() => SendAsync(command));
    }

    [Test]
    public async Task ShouldRejectEmptyTitle()
    {
        await RunAsDefaultUserAsync();

        var command = new CreateRecipeCommand { Title = "", BaseServings = 4 };

        await Should.ThrowAsync<ValidationException>(() => SendAsync(command));
    }

    [Test]
    public async Task ShouldRejectZeroBaseServings()
    {
        await RunAsDefaultUserAsync();

        var command = new CreateRecipeCommand { Title = "Pasta", BaseServings = 0 };

        await Should.ThrowAsync<ValidationException>(() => SendAsync(command));
    }

    [Test]
    public async Task ShouldPersistRecipeWithIngredientsAndSteps()
    {
        var userId = await RunAsDefaultUserAsync();

        var command = new CreateRecipeCommand
        {
            Title = "Broodje pulled pork met koolsla",
            BaseServings = 4,
            Summary = "Zelfgemaakte pulled pork in een zacht broodje.",
            SourceUrl = "https://dagelijksekost.vrt.be/gerechten/broodje-pulled-pork-met-koolsla",
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "Varkensschouder", Amount = 1, Unit = "kg" },
                new CreateRecipeIngredient { Name = "Witte kool", Amount = 250, Unit = "g", Notes = "fijn gesneden" },
                new CreateRecipeIngredient { Name = "Zachte broodjes", Amount = 4, Unit = "" }
            ],
            Steps =
            [
                "Kruid de varkensschouder royaal met zout en peper.",
                "Braad de schouder rondom aan in een hete pan.",
                "Gaar de schouder 6 uur op lage temperatuur tot het vlees uit elkaar valt."
            ]
        };

        var id = await SendAsync(command);

        var recipe = await ExecuteAsync(ctx => ctx.Recipes
            .Include(r => r.Ingredients)
            .Include(r => r.Steps)
            .FirstOrDefaultAsync(r => r.Id == id));

        recipe.ShouldNotBeNull();
        recipe.Title.ShouldBe(command.Title);
        recipe.BaseServings.ShouldBe(4);
        recipe.Summary.ShouldBe(command.Summary);
        recipe.SourceUrl.ShouldBe(command.SourceUrl);
        recipe.CreatedBy.ShouldBe(userId);

        recipe.Ingredients.Count.ShouldBe(3);
        var pork = recipe.Ingredients.Single(i => i.Name == "Varkensschouder");
        pork.Quantity.Amount.ShouldBe(1);
        pork.Quantity.Unit.ShouldBe("kg");

        recipe.Steps.Count.ShouldBe(3);
        recipe.Steps.OrderBy(s => s.Order).First().Instruction
            .ShouldBe("Kruid de varkensschouder royaal met zout en peper.");
    }

    [Test]
    public async Task ShouldScaleIngredientsProportionally()
    {
        await RunAsDefaultUserAsync();

        var id = await SendAsync(new CreateRecipeCommand
        {
            Title = "Pasta",
            BaseServings = 4,
            Ingredients =
            [
                new CreateRecipeIngredient { Name = "Pasta", Amount = 400, Unit = "g" }
            ]
        });

        var recipe = await ExecuteAsync(ctx => ctx.Recipes
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == id));

        recipe.ShouldNotBeNull();

        var factor = recipe.ScaleFactorFor(6);
        factor.ShouldBe(1.5m);

        var scaled = recipe.Ingredients.Single().Quantity.Scale(factor);
        scaled.Amount.ShouldBe(600m);
        scaled.Unit.ShouldBe("g");
    }
}
