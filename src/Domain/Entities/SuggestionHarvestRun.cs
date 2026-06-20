using Cookmate.Domain.Enums;

namespace Cookmate.Domain.Entities;

/// <summary>
/// A persisted diagnostics record of one harvest run. Captures the full per-source
/// and per-URL outcome (including failures with their error messages) so a run can
/// be inspected long after it finished — the key debugging surface for scraping,
/// which is inherently brittle. Both the weekly job and manual "Harvest now" runs
/// write one of these.
/// </summary>
public class SuggestionHarvestRun : BaseAuditableEntity
{
    private readonly List<HarvestSourceLog> _sources = new();

    /// <summary>The single source a manual run targeted, or null for an "all enabled sources" run.</summary>
    public int? SourceId { get; private set; }

    public HarvestTrigger Trigger { get; private set; }

    public DateTimeOffset StartedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    public HarvestStatus Status { get; private set; }

    public int Discovered { get; private set; }

    public int Inserted { get; private set; }

    public int SkippedDuplicate { get; private set; }

    public int Failed { get; private set; }

    /// <summary>Full per-source / per-URL detail, persisted as a JSON document.</summary>
    public IReadOnlyList<HarvestSourceLog> Sources => _sources.AsReadOnly();

    private SuggestionHarvestRun() { }

    public SuggestionHarvestRun(HarvestTrigger trigger, DateTimeOffset startedAt, int? sourceId = null)
    {
        Trigger = trigger;
        StartedAt = startedAt;
        SourceId = sourceId;
    }

    /// <summary>
    /// Finalises the run from the collected source logs: stores them, rolls up the
    /// counts, and derives the overall status (Failed when nothing succeeded and at
    /// least one thing failed; PartialFailure when some failed; Succeeded otherwise).
    /// </summary>
    public void Complete(IEnumerable<HarvestSourceLog> sources, DateTimeOffset finishedAt)
    {
        _sources.Clear();
        _sources.AddRange(sources);

        Discovered = _sources.Sum(s => s.Discovered);
        Inserted = _sources.Sum(s => s.Inserted);
        SkippedDuplicate = _sources.Sum(s => s.SkippedDuplicate);
        Failed = _sources.Sum(s => s.Failed) + _sources.Count(s => s.Error is not null);
        FinishedAt = finishedAt;

        var anySuccess = Inserted > 0 || SkippedDuplicate > 0;
        Status = Failed == 0
            ? HarvestStatus.Succeeded
            : anySuccess ? HarvestStatus.PartialFailure : HarvestStatus.Failed;
    }
}

/// <summary>Per-source slice of a harvest run. A source-level <see cref="Error"/> means discovery failed.</summary>
public record HarvestSourceLog
{
    public int? SourceId { get; init; }

    public string SourceName { get; init; } = string.Empty;

    public string Host { get; init; } = string.Empty;

    public int Discovered { get; init; }

    public int Inserted { get; init; }

    public int SkippedDuplicate { get; init; }

    public int Failed { get; init; }

    /// <summary>Set when discovery itself failed for this source (so no items were attempted).</summary>
    public string? Error { get; init; }

    public IReadOnlyList<HarvestItemLog> Items { get; init; } = [];
}

/// <summary>Per-URL outcome within a source.</summary>
public record HarvestItemLog
{
    public string Url { get; init; } = string.Empty;

    public HarvestItemStatus Status { get; init; }

    public string? Title { get; init; }

    /// <summary>The exception message when <see cref="Status"/> is <see cref="HarvestItemStatus.Failed"/>.</summary>
    public string? Error { get; init; }
}
