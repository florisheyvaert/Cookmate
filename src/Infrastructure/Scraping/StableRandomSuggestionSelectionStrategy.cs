using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// v1 weekly-proposal selection: a deterministic shuffle seeded by the week, so the
/// proposal is effectively random but stable across reloads within the same week.
/// The future rules engine (Wednesday = fish, never Monday, …) replaces this behind
/// <see cref="ISuggestionSelectionStrategy"/>.
/// </summary>
public class StableRandomSuggestionSelectionStrategy : ISuggestionSelectionStrategy
{
    public IReadOnlyList<MealSuggestion> Pick(IReadOnlyList<MealSuggestion> pool, DateOnly weekStart, int count)
    {
        if (pool.Count == 0 || count <= 0) return [];

        // Seed by the week so the same week yields the same picks; order by Id first
        // so the result is independent of the pool's incoming order.
        var rng = new Random(weekStart.DayNumber);

        return pool
            .OrderBy(s => s.Id)
            .Select(s => (Suggestion: s, Key: rng.Next()))
            .OrderBy(x => x.Key)
            .Select(x => x.Suggestion)
            .Take(Math.Min(count, pool.Count))
            .ToList();
    }
}
