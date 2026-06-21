using Cookmate.Domain.Common;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Common;

public class UnitConversionTests
{
    [TestCase("g", UnitFamily.Mass)]
    [TestCase("kg", UnitFamily.Mass)]
    [TestCase("mg", UnitFamily.Mass)]
    [TestCase("ml", UnitFamily.Volume)]
    [TestCase("l", UnitFamily.Volume)]
    [TestCase("el", UnitFamily.Volume)]
    [TestCase("tl", UnitFamily.Volume)]
    [TestCase("cup", UnitFamily.Volume)]
    [TestCase("st", UnitFamily.Count)]
    [TestCase("teen", UnitFamily.Count)]
    [TestCase("", UnitFamily.Unknown)]
    [TestCase("snufje", UnitFamily.Unknown)]
    public void Classify_AssignsExpectedFamily(string unit, UnitFamily expected)
    {
        UnitConversion.Classify(unit).ShouldBe(expected);
    }

    [TestCase(2, "kg", 2000)]
    [TestCase(500, "mg", 0.5)]
    [TestCase(1, "l", 1000)]
    [TestCase(1, "dl", 100)]
    [TestCase(1, "cl", 10)]
    [TestCase(1, "el", 15)]
    [TestCase(1, "tl", 5)]
    [TestCase(1, "cup", 240)]
    [TestCase(3, "st", 3)]
    public void ToBase_ConvertsWithinFamily(decimal amount, string unit, decimal expected)
    {
        UnitConversion.ToBase(amount, unit).ShouldBe(expected);
    }
}
