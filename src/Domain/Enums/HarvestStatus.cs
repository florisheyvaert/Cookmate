namespace Cookmate.Domain.Enums;

/// <summary>Overall outcome of a harvest run (or a single source within it).</summary>
public enum HarvestStatus
{
    /// <summary>Everything that was attempted succeeded (or there was simply nothing to do).</summary>
    Succeeded = 0,

    /// <summary>Some items or sources failed but others went through.</summary>
    PartialFailure = 1,

    /// <summary>Nothing succeeded — e.g. discovery failed for every source.</summary>
    Failed = 2,

    /// <summary>The run is currently in progress — counts climb until it finalises.</summary>
    Processing = 3,
}
