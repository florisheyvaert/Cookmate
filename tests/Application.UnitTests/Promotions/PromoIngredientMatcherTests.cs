using Cookmate.Application.Promotions.Common;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Application.UnitTests.Promotions;

public class PromoIngredientMatcherTests
{
    private static bool Match(string promoTitle, string ingredient) =>
        PromoIngredientMatcher.Matches(PromoIngredientMatcher.FoodStems(promoTitle), ingredient);

    [TestCase("AH Scharrel kipfilet 4-pack", "kipfilet")]
    [TestCase("AH Scharrel kipfilet 4-pack", "kipfilets")]
    [TestCase("AH Broccoli", "broccoli")]
    [TestCase("AH Komkommer", "komkommer")]
    [TestCase("AH Uien net", "ui")]
    [TestCase("AH Uien net", "uien")]
    [TestCase("AH Vleestomaat", "tomaten")]
    [TestCase("AH Tomaten", "tomaat")]
    [TestCase("AH Hollandse garnalen", "grijze garnalen")]
    [TestCase("AH Knoflook", "teentjes knoflook")]
    [TestCase("AH Kruimige aardappelen", "vastkokende aardappelen")]
    public void Matches_when_food_word_overlaps(string promo, string ingredient)
    {
        Match(promo, ingredient).ShouldBeTrue();
    }

    [TestCase("AH Scharrel kipfilet 4-pack", "rundvlees")]
    [TestCase("AH Broccoli", "bloemkool")]
    [TestCase("Coca-Cola Zero sugar 4-pack", "kipfilet")]
    [TestCase("AH Komkommer", "courgette")]
    public void Does_not_match_unrelated_ingredients(string promo, string ingredient)
    {
        Match(promo, ingredient).ShouldBeFalse();
    }

    [Test]
    public void Brand_and_pack_noise_does_not_produce_matches()
    {
        // "ah", "4-pack" etc. are noise — an ingredient literally named "pack" shouldn't hit.
        Match("AH Scharrel kipfilet 4-pack", "pack").ShouldBeFalse();
        Match("AH Biologisch Fairtrade bananen", "biologisch").ShouldBeFalse();
    }

    [Test]
    public void FoodStems_strips_noise_and_keeps_food_tokens()
    {
        var stems = PromoIngredientMatcher.FoodStems("AH Scharrel kipfilet 4-pack");
        stems.ShouldContain("kipfilet");
        stems.ShouldNotContain("ah");
        stems.ShouldNotContain("pack");
    }
}
