namespace Cookmate.Domain.Enums;

/// <summary>What kicked off an integration run (harvest or promo refresh).</summary>
public enum RunTrigger
{
    /// <summary>A scheduled background job.</summary>
    Scheduled = 0,

    /// <summary>A user pressed "Run now" in the UI.</summary>
    Manual = 1,
}
