using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using NUnit.Framework;
using Shouldly;

namespace Cookmate.Domain.UnitTests.Entities;

public class SuggestionSourceTests
{
    [Test]
    public void Constructor_RequiresName()
    {
        Should.Throw<ArgumentException>(() => new SuggestionSource(" ", "example.com"));
    }

    [Test]
    public void SetHost_StripsSchemeAndLowercases()
    {
        var source = new SuggestionSource("Dagelijkse Kost", "HTTPS://Dagelijksekost.VRT.be/gerechten");

        source.Host.ShouldBe("dagelijksekost.vrt.be");
    }

    [Test]
    public void SetListingUrls_TrimsAndDedupes()
    {
        var source = new SuggestionSource("X", "x.com");

        source.SetListingUrls(new[] { " https://x.com/a ", "https://x.com/a", "https://x.com/b", "" });

        source.ListingUrls.ShouldBe(new[] { "https://x.com/a", "https://x.com/b" });
    }

    [Test]
    public void SetMaxPerRun_RejectsZeroOrNegative()
    {
        var source = new SuggestionSource("X", "x.com");

        Should.Throw<ArgumentOutOfRangeException>(() => source.SetMaxPerRun(0));
        source.SetMaxPerRun(null);
        source.MaxPerRun.ShouldBeNull();
        source.SetMaxPerRun(25);
        source.MaxPerRun.ShouldBe(25);
    }

    [Test]
    public void EnableDisable_TogglesFlag()
    {
        var source = new SuggestionSource("X", "x.com");

        source.Disable();
        source.Enabled.ShouldBeFalse();
        source.Enable();
        source.Enabled.ShouldBeTrue();
    }

    [Test]
    public void RecordRun_StoresTelemetry()
    {
        var source = new SuggestionSource("X", "x.com");
        var at = new DateTimeOffset(2026, 6, 20, 3, 0, 0, TimeSpan.Zero);

        source.RecordRun(at, RunStatus.PartialFailure, 7);

        source.LastRunAt.ShouldBe(at);
        source.LastRunStatus.ShouldBe(RunStatus.PartialFailure);
        source.LastRunCount.ShouldBe(7);
    }
}
