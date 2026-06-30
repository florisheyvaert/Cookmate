using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.MealSuggestions.Common;

/// <summary>
/// The result of an integration run (harvest or promo refresh), returned to the caller
/// (shown immediately after a manual run) and mirroring what is persisted on
/// <see cref="IntegrationRun"/>. Reuses the domain <see cref="HarvestSourceLog"/>/
/// <see cref="HarvestItemLog"/> records so there is a single shape for the per-source detail.
/// Shared by both capabilities; it lives here for historical reasons.
/// </summary>
public record IntegrationRunReport
{
    public int RunId { get; init; }

    public IntegrationJobKind Kind { get; init; }

    public RunTrigger Trigger { get; init; }

    public RunStatus Status { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public DateTimeOffset? FinishedAt { get; init; }

    public int Discovered { get; init; }

    public int Inserted { get; init; }

    public int SkippedDuplicate { get; init; }

    public int Failed { get; init; }

    public IReadOnlyList<HarvestSourceLog> Sources { get; init; } = [];

    public static IntegrationRunReport From(IntegrationRun run) => new()
    {
        RunId = run.Id,
        Kind = run.Kind,
        Trigger = run.Trigger,
        Status = run.Status,
        StartedAt = run.StartedAt,
        FinishedAt = run.FinishedAt,
        Discovered = run.Discovered,
        Inserted = run.Inserted,
        SkippedDuplicate = run.SkippedDuplicate,
        Failed = run.Failed,
        Sources = run.Sources,
    };
}
