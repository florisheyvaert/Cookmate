using Cookmate.Domain.Common;
using Cookmate.Domain.ValueObjects;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Common;

public class PackQuantityCalculatorTests
{
    private static Quantity Pack(decimal amount, string unit) => new(amount, unit);

    [Test]
    public void TwoNeeded_FromAPackOfSix_IsOnePack()
    {
        // The over-buy fix: 2 tomatoes from a 6-pack must be ONE pack, not two.
        PackQuantityCalculator.Calculate(2, "st", Pack(6, "st"), 1, 1m).ShouldBe(1);
    }

    [Test]
    public void OneNeeded_FromAPackOfSix_IsOnePack()
    {
        PackQuantityCalculator.Calculate(1, "st", Pack(6, "st"), 1, 1m).ShouldBe(1);
    }

    [Test]
    public void SevenNeeded_FromAPackOfSix_IsTwoPacks()
    {
        PackQuantityCalculator.Calculate(7, "st", Pack(6, "st"), 1, 1m).ShouldBe(2);
    }

    [Test]
    public void Mass_ConvertsAcrossUnits()
    {
        // 300 g from a 1 kg bag → 1.
        PackQuantityCalculator.Calculate(300, "g", Pack(1, "kg"), 1, 1m).ShouldBe(1);
        // 1200 g from a 1 kg bag → 2.
        PackQuantityCalculator.Calculate(1200, "g", Pack(1, "kg"), 1, 1m).ShouldBe(2);
    }

    [Test]
    public void IncompatibleUnits_FallBackToDefaultPackQuantity()
    {
        // "snufje" (unknown) vs grams → falls back to the user default (×scale, ceiled).
        PackQuantityCalculator.Calculate(1, "snufje", Pack(500, "g"), 1, 1m).ShouldBe(1);
    }

    [Test]
    public void NeverReturnsLessThanOne()
    {
        PackQuantityCalculator.Calculate(0, "st", Pack(6, "st"), 1, 1m).ShouldBe(1);
    }
}
