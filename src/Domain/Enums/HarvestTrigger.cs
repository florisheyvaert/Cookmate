namespace Cookmate.Domain.Enums;

/// <summary>What kicked off a suggestion-harvest run.</summary>
public enum HarvestTrigger
{
    /// <summary>The weekly background job.</summary>
    Scheduled = 0,

    /// <summary>A user pressed "Harvest now" in the UI.</summary>
    Manual = 1,
}
