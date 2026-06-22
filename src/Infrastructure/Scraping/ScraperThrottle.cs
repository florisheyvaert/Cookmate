using System.Collections.Concurrent;
using Microsoft.Extensions.Options;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Spacing for outbound scraper requests. Recipe sites (notably ah.nl, behind
/// Akamai) flag a fast, regular burst of requests from one IP as a bot and start
/// returning 403s — so we leave a randomised gap between requests to each host.
/// </summary>
public sealed class ScraperThrottleOptions
{
    public const string SectionName = "Scraping:Throttle";

    /// <summary>Minimum gap between two requests to the same host (ms).</summary>
    public int MinDelayMs { get; set; } = 1500;

    /// <summary>Maximum gap; the real gap is random in [Min, Max] to avoid a robotic cadence (ms).</summary>
    public int MaxDelayMs { get; set; } = 4000;
}

/// <summary>
/// Per-host request spacing, shared as a singleton so every scraper client (the
/// sitemap fetch and the recipe-page fetches) keeps to one polite cadence per host.
/// The first request to a host is not delayed.
/// </summary>
public sealed class ScraperThrottle
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _gates = new();
    private readonly ConcurrentDictionary<string, long> _lastStart = new();
    private readonly TimeProvider _time;
    private readonly ScraperThrottleOptions _options;

    public ScraperThrottle(TimeProvider time, IOptions<ScraperThrottleOptions> options)
    {
        _time = time;
        _options = options.Value;
    }

    public async Task WaitTurnAsync(string host, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(host)) return;

        // One waiter per host so the read-delay-write below stays consistent.
        var gate = _gates.GetOrAdd(host, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            var min = Math.Max(0, _options.MinDelayMs);
            var max = Math.Max(min, _options.MaxDelayMs);

            if (_lastStart.TryGetValue(host, out var last))
            {
                var target = TimeSpan.FromMilliseconds(Random.Shared.Next(min, max + 1));
                var wait = target - _time.GetElapsedTime(last);
                if (wait > TimeSpan.Zero)
                {
                    await Task.Delay(wait, _time, cancellationToken);
                }
            }

            _lastStart[host] = _time.GetTimestamp();
        }
        finally
        {
            gate.Release();
        }
    }
}

/// <summary>Applies <see cref="ScraperThrottle"/> before each scraper request.</summary>
public sealed class ThrottlingScraperHandler : DelegatingHandler
{
    private readonly ScraperThrottle _throttle;

    public ThrottlingScraperHandler(ScraperThrottle throttle) => _throttle = throttle;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        await _throttle.WaitTurnAsync(request.RequestUri?.Host ?? string.Empty, cancellationToken);
        return await base.SendAsync(request, cancellationToken);
    }
}
