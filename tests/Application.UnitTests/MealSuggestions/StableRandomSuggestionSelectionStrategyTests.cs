using Cookmate.Domain.Entities;
using Cookmate.Infrastructure.Scraping;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Application.UnitTests.MealSuggestions;

public class StableRandomSuggestionSelectionStrategyTests
{
    private static readonly DateOnly Harvested = new(2026, 6, 1);

    private static List<MealSuggestion> Pool(int n) =>
        Enumerable.Range(1, n)
            .Select(i => new MealSuggestion(1, $"Dish {i}", $"https://example.com/{i}", Harvested))
            .ToList();

    private readonly StableRandomSuggestionSelectionStrategy _strategy = new();

    [Test]
    public void Pick_ReturnsRequestedCount_WhenPoolIsLargeEnough()
    {
        var picked = _strategy.Pick(Pool(20), new DateOnly(2026, 6, 15), 7);

        picked.Count.ShouldBe(7);
    }

    [Test]
    public void Pick_IsCappedByPoolSize()
    {
        var picked = _strategy.Pick(Pool(3), new DateOnly(2026, 6, 15), 7);

        picked.Count.ShouldBe(3);
    }

    [Test]
    public void Pick_EmptyPool_ReturnsEmpty()
    {
        _strategy.Pick(new List<MealSuggestion>(), new DateOnly(2026, 6, 15), 7).ShouldBeEmpty();
    }

    [Test]
    public void Pick_IsStableForTheSameWeek()
    {
        var pool = Pool(20);
        var week = new DateOnly(2026, 6, 15);

        var first = _strategy.Pick(pool, week, 7).Select(s => s.SourceUrl).ToList();
        var second = _strategy.Pick(pool, week, 7).Select(s => s.SourceUrl).ToList();

        second.ShouldBe(first);
    }

    [Test]
    public void Pick_DiffersAcrossWeeks()
    {
        var pool = Pool(40);

        var weekA = _strategy.Pick(pool, new DateOnly(2026, 6, 15), 7).Select(s => s.SourceUrl).ToList();
        var weekB = _strategy.Pick(pool, new DateOnly(2026, 6, 22), 7).Select(s => s.SourceUrl).ToList();

        weekA.ShouldNotBe(weekB);
    }
}
