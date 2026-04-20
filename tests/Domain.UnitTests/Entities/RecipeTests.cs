using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Cookmate.Domain.ValueObjects;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Entities;

public class RecipeTests
{
    [Test]
    public void Constructor_RequiresNonEmptyTitle()
    {
        Should.Throw<ArgumentException>(() => new Recipe(" ", 4));
    }

    [Test]
    public void Constructor_RejectsBaseServingsBelowOne()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new Recipe("Pasta", 0));
    }

    [Test]
    public void ScaleFactorFor_ReturnsTargetOverBase()
    {
        var recipe = new Recipe("Pasta", 4);

        recipe.ScaleFactorFor(6).ShouldBe(1.5m);
        recipe.ScaleFactorFor(2).ShouldBe(0.5m);
        recipe.ScaleFactorFor(4).ShouldBe(1m);
    }

    [Test]
    public void ScaleFactorFor_RejectsTargetBelowOne()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new Recipe("Pasta", 4).ScaleFactorFor(0));
    }

    [Test]
    public void AddIngredient_AssignsSequentialOrders()
    {
        var recipe = new Recipe("Pasta", 4);

        var a = recipe.AddIngredient("Pasta", new Quantity(400, "g"));
        var b = recipe.AddIngredient("Olijfolie", new Quantity(2, "tbsp"));

        a.Order.ShouldBe(0);
        b.Order.ShouldBe(1);
        recipe.Ingredients.Count.ShouldBe(2);
    }

    [Test]
    public void RemoveIngredient_ReindexesRemaining()
    {
        var recipe = new Recipe("Pasta", 4);
        var first = recipe.AddIngredient("A", new Quantity(1, "g"));
        var second = recipe.AddIngredient("B", new Quantity(2, "g"));
        var third = recipe.AddIngredient("C", new Quantity(3, "g"));

        recipe.RemoveIngredient(second);

        recipe.Ingredients.Count.ShouldBe(2);
        first.Order.ShouldBe(0);
        third.Order.ShouldBe(1);
    }

    [Test]
    public void AddStep_AppendsAndOrdersByInsertion()
    {
        var recipe = new Recipe("Pasta", 4);

        recipe.AddStep("Bring water to a boil.");
        var second = recipe.AddStep("Add pasta and cook for 8 minutes.");

        recipe.Steps.Count.ShouldBe(2);
        second.Order.ShouldBe(1);
        second.Instruction.ShouldBe("Add pasta and cook for 8 minutes.");
    }

    [Test]
    public void AddMedia_StoresLocalPathAndType()
    {
        var recipe = new Recipe("Pasta", 4);

        var media = recipe.AddMedia("/storage/recipes/pasta.jpg", MediaType.Photo, "Plated");

        media.LocalPath.ShouldBe("/storage/recipes/pasta.jpg");
        media.Type.ShouldBe(MediaType.Photo);
        media.Caption.ShouldBe("Plated");
        media.Order.ShouldBe(0);
    }

    [Test]
    public void Scaling_AppliedAcrossIngredients_ProducesExpectedAmounts()
    {
        var recipe = new Recipe("Pasta", 4);
        recipe.AddIngredient("Pasta", new Quantity(400, "g"));
        recipe.AddIngredient("Olijfolie", new Quantity(2, "tbsp"));

        var factor = recipe.ScaleFactorFor(6);
        var scaled = recipe.Ingredients.Select(i => i.Quantity.Scale(factor)).ToList();

        scaled[0].Amount.ShouldBe(600m);
        scaled[1].Amount.ShouldBe(3m);
    }
}
