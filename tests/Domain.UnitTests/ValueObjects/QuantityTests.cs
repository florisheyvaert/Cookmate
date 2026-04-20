using Cookmate.Domain.ValueObjects;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.ValueObjects;

public class QuantityTests
{
    [Test]
    public void Constructor_TrimsUnitAndStoresAmount()
    {
        var qty = new Quantity(2.5m, "  g  ");

        qty.Amount.ShouldBe(2.5m);
        qty.Unit.ShouldBe("g");
    }

    [Test]
    public void Constructor_TreatsNullUnitAsEmptyString()
    {
        var qty = new Quantity(3, null);

        qty.Unit.ShouldBe(string.Empty);
    }

    [Test]
    public void Constructor_RejectsNegativeAmount()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new Quantity(-1, "g"));
    }

    [Test]
    public void Scale_MultipliesAmountAndPreservesUnit()
    {
        var qty = new Quantity(200, "g");

        var scaled = qty.Scale(1.5m);

        scaled.Amount.ShouldBe(300);
        scaled.Unit.ShouldBe("g");
    }

    [Test]
    public void Scale_ByZeroProducesZero()
    {
        var scaled = new Quantity(200, "g").Scale(0);

        scaled.Amount.ShouldBe(0);
    }

    [Test]
    public void Scale_RejectsNegativeFactor()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new Quantity(1, "g").Scale(-1));
    }

    [Test]
    public void Equality_IsValueBased()
    {
        var a = new Quantity(100, "ml");
        var b = new Quantity(100, "ml");
        var c = new Quantity(100, "g");

        (a == b).ShouldBeTrue();
        (a == c).ShouldBeFalse();
    }
}
