using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Promotions.Commands.RefreshPromotions;
using Cookmate.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Shopping;

/// <summary>
/// Runs the automatic promotion refresh on the schedule the user set (weekday + local time),
/// across every enabled store. Same shape as the meal-suggestion harvester: ticks every few
/// minutes, reads the schedule each time, fires once per occurrence via a last-run marker, and
/// catches up a missed run after downtime. In-process / single-instance, which suits this
/// personal app. Manual refreshes go through the same command.
/// </summary>
public class PromotionRefreshService : BackgroundService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeOnly DefaultTime = new(6, 0);
    private const DayOfWeek DefaultDay = DayOfWeek.Wednesday;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<PromotionRefreshService> _logger;

    public PromotionRefreshService(
        IServiceScopeFactory scopeFactory,
        TimeProvider timeProvider,
        ILogger<PromotionRefreshService> logger)
    {
        _scopeFactory = scopeFactory;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await ResetOrphanedRunsAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reset orphaned promotion-refresh runs on startup.");
        }

        using var timer = new PeriodicTimer(TickInterval, _timeProvider);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndRunAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled promotion-refresh check failed.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task CheckAndRunAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var schedule = await db.PromotionRefreshSchedules.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var enabled = schedule?.Enabled ?? true;
        if (!enabled) return;

        // Nothing to do if no store has the promotions capability switched on.
        var anyEnabledStore = await db.StorePromotionSettings.AsNoTracking()
            .AnyAsync(s => s.Enabled, cancellationToken);
        if (!anyEnabledStore) return;

        var day = schedule?.DayOfWeek ?? DefaultDay;
        var time = schedule?.TimeOfDay ?? DefaultTime;

        var now = _timeProvider.GetLocalNow();
        var occurrence = MostRecentOccurrence(now, day, time);

        var lastScheduled = await db.IntegrationRuns.AsNoTracking()
            .Where(r => r.Kind == IntegrationJobKind.Promotions && r.Trigger == RunTrigger.Scheduled)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => (DateTimeOffset?)r.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastScheduled is not null && lastScheduled >= occurrence) return;

        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        var report = await sender.Send(
            new RefreshPromotionsCommand { Trigger = RunTrigger.Scheduled },
            cancellationToken);

        _logger.LogInformation(
            "Scheduled promotion refresh finished with status {Status}: {Cached} cached, {Failed} failed.",
            report.Status, report.Inserted, report.Failed);
    }

    /// <summary>Finalises any run/store left mid-refresh by a previous process so the UI never shows a stuck "processing".</summary>
    private async Task ResetOrphanedRunsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var now = _timeProvider.GetUtcNow();

        var stuckRuns = await db.IntegrationRuns
            .Where(r => r.Kind == IntegrationJobKind.Promotions && r.Status == RunStatus.Processing)
            .ToListAsync(cancellationToken);
        var stuckStores = await db.StorePromotionSettings
            .Where(s => s.LastRunStatus == RunStatus.Processing)
            .ToListAsync(cancellationToken);

        if (stuckRuns.Count == 0 && stuckStores.Count == 0) return;

        foreach (var run in stuckRuns) run.MarkInterrupted(now);
        foreach (var store in stuckStores) store.MarkRunInterrupted();
        await db.SaveChangesAsync(cancellationToken);

        _logger.LogWarning(
            "Reset {Runs} promotion-refresh run(s) and {Stores} store(s) left in Processing after a restart.",
            stuckRuns.Count, stuckStores.Count);
    }

    /// <summary>The most recent moment matching the configured weekday + time at or before now.</summary>
    private static DateTimeOffset MostRecentOccurrence(DateTimeOffset now, DayOfWeek day, TimeOnly time)
    {
        var diffDays = (int)day - (int)now.DayOfWeek;
        var dateThisWeek = now.Date.AddDays(diffDays);
        var candidate = new DateTimeOffset(dateThisWeek.Add(time.ToTimeSpan()), now.Offset);
        return candidate > now ? candidate.AddDays(-7) : candidate;
    }
}
