using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.MealSuggestions.Common;

/// <summary>
/// The result of a harvest run, returned to the caller (shown immediately after a
/// manual run) and mirroring what is persisted on <see cref="SuggestionHarvestRun"/>.
/// Reuses the domain <see cref="HarvestSourceLog"/>/<see cref="HarvestItemLog"/>
/// records so there is a single shape for the per-URL detail.
/// </summary>
public record HarvestReport
{
    public int RunId { get; init; }

    public HarvestTrigger Trigger { get; init; }

    public HarvestStatus Status { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public DateTimeOffset? FinishedAt { get; init; }

    public int Discovered { get; init; }

    public int Inserted { get; init; }

    public int SkippedDuplicate { get; init; }

    public int Failed { get; init; }

    public IReadOnlyList<HarvestSourceLog> Sources { get; init; } = [];

    public static HarvestReport From(SuggestionHarvestRun run) => new()
    {
        RunId = run.Id,
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
