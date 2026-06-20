using Cookmate.Application.MealSuggestions.Commands.HarvestMealSuggestions;
using Cookmate.Domain.Enums;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Runs the suggestion harvest once a week (Monday, early morning) across all
/// enabled sources. In-process and single-instance, which suits this personal app
/// (Aspire dev + a single deploy). Manual per-source runs go through the same
/// <see cref="HarvestMealSuggestionsCommand"/> from the UI.
/// </summary>
public class MealSuggestionHarvestService : BackgroundService
{
    private static readonly TimeOnly RunAt = new(3, 0);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<MealSuggestionHarvestService> _logger;

    public MealSuggestionHarvestService(
        IServiceScopeFactory scopeFactory,
        TimeProvider timeProvider,
        ILogger<MealSuggestionHarvestService> logger)
    {
        _scopeFactory = scopeFactory;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeUntilNextRun();
            _logger.LogInformation("Next meal-suggestion harvest scheduled in {Delay}.", delay);

            try
            {
                await Task.Delay(delay, _timeProvider, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await RunOnceAsync(stoppingToken);
        }
    }

    private async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var sender = scope.ServiceProvider.GetRequiredService<ISender>();

            var report = await sender.Send(
                new HarvestMealSuggestionsCommand { Trigger = HarvestTrigger.Scheduled },
                cancellationToken);

            _logger.LogInformation(
                "Weekly harvest finished with status {Status}: {Inserted} inserted, {Skipped} skipped, {Failed} failed.",
                report.Status, report.Inserted, report.SkippedDuplicate, report.Failed);
        }
        catch (Exception ex)
        {
            // The run itself is best-effort; never let a failure tear down the host.
            _logger.LogError(ex, "Weekly meal-suggestion harvest failed.");
        }
    }

    private TimeSpan TimeUntilNextRun()
    {
        var now = _timeProvider.GetLocalNow();
        var daysUntilMonday = ((int)DayOfWeek.Monday - (int)now.DayOfWeek + 7) % 7;

        var nextDate = now.Date.AddDays(daysUntilMonday).Add(RunAt.ToTimeSpan());
        var next = new DateTimeOffset(nextDate, now.Offset);
        if (next <= now)
        {
            next = next.AddDays(7);
        }

        return next - now;
    }
}
