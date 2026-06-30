using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Entities;

public class IntegrationRunTests
{
    private static readonly DateTimeOffset Start = new(2026, 6, 20, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset End = Start.AddMinutes(2);

    [Test]
    public void Complete_RollsUpCounts()
    {
        var run = new IntegrationRun(RunTrigger.Manual, Start);

        run.Complete(new[]
        {
            new HarvestSourceLog { Discovered = 5, Inserted = 3, SkippedDuplicate = 1, Failed = 1 },
            new HarvestSourceLog { Discovered = 2, Inserted = 2 },
        }, End);

        run.Discovered.ShouldBe(7);
        run.Inserted.ShouldBe(5);
        run.SkippedDuplicate.ShouldBe(1);
        run.Failed.ShouldBe(1);
        run.FinishedAt.ShouldBe(End);
    }

    [Test]
    public void Complete_AllSucceeded_IsSucceeded()
    {
        var run = new IntegrationRun(RunTrigger.Scheduled, Start);

        run.Complete(new[] { new HarvestSourceLog { Discovered = 2, Inserted = 2 } }, End);

        run.Status.ShouldBe(RunStatus.Succeeded);
    }

    [Test]
    public void Complete_SomeInsertedSomeFailed_IsPartialFailure()
    {
        var run = new IntegrationRun(RunTrigger.Scheduled, Start);

        run.Complete(new[] { new HarvestSourceLog { Inserted = 1, Failed = 2 } }, End);

        run.Status.ShouldBe(RunStatus.PartialFailure);
    }

    [Test]
    public void Complete_NothingSucceeded_IsFailed()
    {
        var run = new IntegrationRun(RunTrigger.Scheduled, Start);

        run.Complete(new[] { new HarvestSourceLog { Error = "discovery boom" } }, End);

        run.Failed.ShouldBe(1);
        run.Status.ShouldBe(RunStatus.Failed);
    }

    [Test]
    public void Complete_CountsSourceLevelErrorsAsFailures()
    {
        var run = new IntegrationRun(RunTrigger.Manual, Start);

        run.Complete(new[]
        {
            new HarvestSourceLog { Inserted = 1 },                 // ok source
            new HarvestSourceLog { Error = "discovery failed" },   // +1 failure
        }, End);

        run.Failed.ShouldBe(1);
        run.Status.ShouldBe(RunStatus.PartialFailure);
    }
}
