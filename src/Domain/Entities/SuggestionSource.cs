using Cookmate.Domain.Enums;

namespace Cookmate.Domain.Entities;

/// <summary>
/// An external site Cookmate harvests meal suggestions from (e.g.
/// dagelijksekost.vrt.be, ah.be). The user adds these from the UI and can
/// enable/disable them. Discovery uses the configured <see cref="ListingUrls"/>
/// (overview/category pages) to find recipe URLs, unless a per-host discoverer
/// overrides that in code. Run telemetry is kept so the last outcome is visible
/// at a glance; the full per-URL detail lives on <see cref="IntegrationRun"/>.
/// </summary>
public class SuggestionSource : BaseAuditableEntity
{
    private readonly List<string> _listingUrls = new();

    public string Name { get; private set; } = string.Empty;

    /// <summary>Bare host, e.g. <c>dagelijksekost.vrt.be</c>. Used to pick a per-host scraper/discoverer.</summary>
    public string Host { get; private set; } = string.Empty;

    public bool Enabled { get; private set; } = true;

    /// <summary>Overview/category pages the generic discoverer crawls for recipe links.</summary>
    public IReadOnlyList<string> ListingUrls => _listingUrls.AsReadOnly();

    /// <summary>Optional cap on how many new suggestions a single run may add for this source.</summary>
    public int? MaxPerRun { get; private set; }

    public DateTimeOffset? LastRunAt { get; private set; }

    public RunStatus? LastRunStatus { get; private set; }

    /// <summary>Number of suggestions inserted on the most recent run.</summary>
    public int? LastRunCount { get; private set; }

    /// <summary>Storage key of the locally-downloaded site favicon, or null when none.</summary>
    public string? FaviconStorageKey { get; private set; }

    private SuggestionSource() { }

    public SuggestionSource(string name, string host)
    {
        Rename(name);
        SetHost(host);
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Source name is required.", nameof(name));
        }

        Name = name.Trim();
    }

    public void SetHost(string host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            throw new ArgumentException("Source host is required.", nameof(host));
        }

        Host = NormaliseHost(host);
    }

    public void Enable() => Enabled = true;

    public void Disable() => Enabled = false;

    public void SetEnabled(bool enabled) => Enabled = enabled;

    public void SetMaxPerRun(int? maxPerRun)
    {
        if (maxPerRun is < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(maxPerRun), "MaxPerRun must be at least 1 when set.");
        }

        MaxPerRun = maxPerRun;
    }

    public void SetListingUrls(IEnumerable<string> urls)
    {
        _listingUrls.Clear();
        foreach (var raw in urls)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var trimmed = raw.Trim();
            if (!_listingUrls.Contains(trimmed))
            {
                _listingUrls.Add(trimmed);
            }
        }
    }

    /// <summary>Marks a harvest as in progress so the UI shows a live "processing" state.</summary>
    public void MarkRunStarted(DateTimeOffset at)
    {
        LastRunAt = at;
        LastRunStatus = RunStatus.Processing;
    }

    /// <summary>Records the outcome of a harvest run for at-a-glance telemetry.</summary>
    public void RecordRun(DateTimeOffset at, RunStatus status, int insertedCount)
    {
        LastRunAt = at;
        LastRunStatus = status;
        LastRunCount = insertedCount;
    }

    /// <summary>Clears a stuck "processing" state left by a restart mid-harvest.</summary>
    public void MarkRunInterrupted()
    {
        if (LastRunStatus == RunStatus.Processing)
        {
            LastRunStatus = LastRunCount > 0 ? RunStatus.PartialFailure : RunStatus.Failed;
        }
    }

    /// <summary>Stores (or clears) the locally-downloaded favicon for this source.</summary>
    public void SetFavicon(string? storageKey)
    {
        FaviconStorageKey = string.IsNullOrWhiteSpace(storageKey) ? null : storageKey;
    }

    /// <summary>
    /// Strips a scheme/path if the user pasted a full URL and lowercases the host
    /// so per-host lookups are stable.
    /// </summary>
    private static string NormaliseHost(string host)
    {
        var value = host.Trim();
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            value = uri.Host;
        }

        return value.ToLowerInvariant();
    }
}
