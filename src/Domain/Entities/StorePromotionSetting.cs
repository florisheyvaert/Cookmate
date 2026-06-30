using Cookmate.Domain.Enums;

namespace Cookmate.Domain.Entities;

/// <summary>
/// Per-store configuration for the promotions ("bonus") capability: whether Cookmate
/// pulls this store's offers, plus at-a-glance telemetry of the last refresh. One row
/// per store code; rows are seeded from the registered promotion sources, so a store
/// only appears here when the code knows how to fetch its promos. The full per-run
/// detail lives on <see cref="IntegrationRun"/> (<see cref="IntegrationJobKind.Promotions"/>).
/// </summary>
public class StorePromotionSetting : BaseAuditableEntity
{
    /// <summary>Store code, e.g. <c>ah</c>. Mirrors the grocery-store / promotion-source code.</summary>
    public string StoreCode { get; private set; } = string.Empty;

    /// <summary>When off, scheduled refreshes skip this store and the UI shows it paused.</summary>
    public bool Enabled { get; private set; }

    public DateTimeOffset? LastRunAt { get; private set; }

    public RunStatus? LastRunStatus { get; private set; }

    /// <summary>Number of promotions cached on the most recent refresh.</summary>
    public int? LastRunCount { get; private set; }

    private StorePromotionSetting() { }

    public StorePromotionSetting(string storeCode, bool enabled = false)
    {
        if (string.IsNullOrWhiteSpace(storeCode))
        {
            throw new ArgumentException("Store code is required.", nameof(storeCode));
        }

        StoreCode = storeCode.Trim().ToLowerInvariant();
        Enabled = enabled;
    }

    public void Enable() => Enabled = true;

    public void Disable() => Enabled = false;

    public void SetEnabled(bool enabled) => Enabled = enabled;

    /// <summary>Marks a refresh as in progress so the UI shows a live "processing" state.</summary>
    public void MarkRunStarted(DateTimeOffset at)
    {
        LastRunAt = at;
        LastRunStatus = RunStatus.Processing;
    }

    /// <summary>Records the outcome of a refresh for at-a-glance telemetry.</summary>
    public void RecordRun(DateTimeOffset at, RunStatus status, int cachedCount)
    {
        LastRunAt = at;
        LastRunStatus = status;
        LastRunCount = cachedCount;
    }

    /// <summary>Clears a stuck "processing" state left by a restart mid-refresh.</summary>
    public void MarkRunInterrupted()
    {
        if (LastRunStatus == RunStatus.Processing)
        {
            LastRunStatus = LastRunCount > 0 ? RunStatus.PartialFailure : RunStatus.Failed;
        }
    }
}
