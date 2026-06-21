using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// Chooses which suggestions make up the week's proposal. v1 is stable-random
/// (seeded by the week, so it doesn't reshuffle on reload). The future rules
/// engine — "Wednesday = fish", "never propose Monday", "5 incl. 1 veggie + 1
/// fish" — slots in as a new implementation behind this seam with no other changes.
/// </summary>
public interface ISuggestionSelectionStrategy
{
    /// <summary>
    /// Picks up to <paramref name="count"/> distinct suggestions from <paramref name="pool"/>
    /// for the week starting <paramref name="weekStart"/>.
    /// </summary>
    IReadOnlyList<MealSuggestion> Pick(IReadOnlyList<MealSuggestion> pool, DateOnly weekStart, int count);
}
