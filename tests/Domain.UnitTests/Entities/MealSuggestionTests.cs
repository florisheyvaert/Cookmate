using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Entities;

public class MealSuggestionTests
{
    private static MealSuggestion New() =>
        new(sourceId: 1, title: "Stoofvlees", sourceUrl: "https://example.com/stoofvlees", harvestedOn: new DateOnly(2026, 6, 20));

    [Test]
    public void Constructor_RequiresPositiveSourceId()
    {
        Should.Throw<ArgumentOutOfRangeException>(() =>
            new MealSuggestion(0, "Soep", "https://x/y", new DateOnly(2026, 1, 1)));
    }

    [Test]
    public void Constructor_RequiresSourceUrl()
    {
        Should.Throw<ArgumentException>(() =>
            new MealSuggestion(1, "Soep", " ", new DateOnly(2026, 1, 1)));
    }

    [Test]
    public void Constructor_RequiresTitle()
    {
        Should.Throw<ArgumentException>(() =>
            new MealSuggestion(1, " ", "https://x/y", new DateOnly(2026, 1, 1)));
    }

    [Test]
    public void Constructor_DefaultsInvalidServingsToFour()
    {
        New().BaseServings.ShouldBe(4);
        new MealSuggestion(1, "Soep", "https://x/y", new DateOnly(2026, 1, 1), baseServings: 0)
            .BaseServings.ShouldBe(4);
    }

    [Test]
    public void SetTags_NormalisesAndDedupes()
    {
        var suggestion = New();

        suggestion.SetTags(new[] { "Hoofdgerecht", "hoofdgerecht", " Vlees ", "" });

        suggestion.Tags.ShouldBe(new[] { "hoofdgerecht", "vlees" });
    }

    [Test]
    public void SetIngredients_DropsBlankNames()
    {
        var suggestion = New();

        suggestion.SetIngredients(new[]
        {
            new SuggestionIngredient("Ui", 2, "st", null),
            new SuggestionIngredient(" ", 1, null, null),
        });

        suggestion.Ingredients.Count.ShouldBe(1);
        suggestion.Ingredients[0].Name.ShouldBe("Ui");
    }

    [Test]
    public void SetSteps_TrimsAndDropsBlanks()
    {
        var suggestion = New();

        suggestion.SetSteps(new[] { "  Snijd de ui  ", "", "Bak aan" });

        suggestion.Steps.ShouldBe(new[] { "Snijd de ui", "Bak aan" });
    }

    [Test]
    public void SetTotalTimeMinutes_NormalisesZeroToNull()
    {
        var suggestion = New();

        suggestion.SetTotalTimeMinutes(0);
        suggestion.TotalTimeMinutes.ShouldBeNull();

        suggestion.SetTotalTimeMinutes(45);
        suggestion.TotalTimeMinutes.ShouldBe(45);
    }

    [Test]
    public void SetImage_TreatsBlankAsNull()
    {
        var suggestion = New();

        suggestion.SetImage("  ");
        suggestion.ImageStorageKey.ShouldBeNull();

        suggestion.SetImage("media/abc.jpg");
        suggestion.ImageStorageKey.ShouldBe("media/abc.jpg");
    }
}
