namespace Cookmate.Domain.Enums;

/// <summary>What happened to a single discovered recipe URL during a harvest.</summary>
public enum HarvestItemStatus
{
    /// <summary>A new <see cref="Entities.MealSuggestion"/> was created from the page.</summary>
    Inserted = 0,

    /// <summary>The URL was already in the pool, so it was skipped.</summary>
    SkippedDuplicate = 1,

    /// <summary>Discovery or scraping of the URL threw — see the recorded error.</summary>
    Failed = 2,
}
