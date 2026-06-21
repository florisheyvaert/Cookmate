using Cookmate.Domain.Common;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Common;

public class StapleAndNameTests
{
    [TestCase("olijfolie", true)]
    [TestCase("extra vierge olijfolie", true)]
    [TestCase("zout", true)]
    [TestCase("zwarte peper", true)]
    [TestCase("bloem", true)]
    [TestCase("tomaat", false)]
    [TestCase("gehakt", false)]
    [TestCase("kipfilet", false)]
    public void IsStaple_DetectsPantryStaples(string normalized, bool expected)
    {
        StapleIngredients.IsStaple(normalized).ShouldBe(expected);
    }

    [TestCase("  Tomaat ", "tomaat")]
    [TestCase("Trostomaten", "trostomaten")]
    [TestCase("Gele   paprika", "gele paprika")]
    [TestCase("OLIJFOLIE", "olijfolie")]
    public void Normalize_LowercasesTrimsAndCollapses(string input, string expected)
    {
        IngredientNameNormalizer.Normalize(input).ShouldBe(expected);
    }
}
