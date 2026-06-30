using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Entities;

public class StorePromotionSettingTests
{
    [Test]
    public void Constructor_NormalisesStoreCode_AndDefaultsToDisabled()
    {
        var setting = new StorePromotionSetting("  AH  ");

        setting.StoreCode.ShouldBe("ah");
        setting.Enabled.ShouldBeFalse();
        setting.LastRunStatus.ShouldBeNull();
    }

    [Test]
    public void Constructor_Throws_WhenStoreCodeBlank()
    {
        Should.Throw<ArgumentException>(() => new StorePromotionSetting("   "));
    }

    [Test]
    public void RecordRun_StoresOutcomeTelemetry()
    {
        var setting = new StorePromotionSetting("ah", enabled: true);
        var at = DateTimeOffset.UtcNow;

        setting.MarkRunStarted(at);
        setting.LastRunStatus.ShouldBe(RunStatus.Processing);

        setting.RecordRun(at, RunStatus.Succeeded, 88);
        setting.LastRunAt.ShouldBe(at);
        setting.LastRunStatus.ShouldBe(RunStatus.Succeeded);
        setting.LastRunCount.ShouldBe(88);
    }

    [Test]
    public void MarkRunInterrupted_DemotesProcessingToFailed_WhenNothingCached()
    {
        var setting = new StorePromotionSetting("ah", enabled: true);
        setting.MarkRunStarted(DateTimeOffset.UtcNow);

        setting.MarkRunInterrupted();

        setting.LastRunStatus.ShouldBe(RunStatus.Failed);
    }
}
