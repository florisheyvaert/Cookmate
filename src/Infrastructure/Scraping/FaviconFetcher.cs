using AngleSharp.Dom;
using Cookmate.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Resolves a site's favicon from its home page (<c>&lt;link rel="icon"&gt;</c>,
/// preferring the higher-resolution apple-touch-icon), falling back to
/// <c>/favicon.ico</c>, then downloads and stores it locally. Best-effort.
/// </summary>
public class FaviconFetcher : IFaviconFetcher
{
    // Favicons are tiny; cap well below the recipe-image limit.
    private const long MaxBytes = 1L * 1024 * 1024;

    private static readonly IReadOnlyDictionary<string, string> AllowedTypes
        = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/png"] = ".png",
            ["image/x-icon"] = ".ico",
            ["image/vnd.microsoft.icon"] = ".ico",
            ["image/svg+xml"] = ".svg",
            ["image/jpeg"] = ".jpg",
            ["image/jpg"] = ".jpg",
            ["image/webp"] = ".webp",
            ["image/gif"] = ".gif",
        };

    private static readonly string[] KnownExtensions = [".png", ".ico", ".svg", ".jpg", ".jpeg", ".webp", ".gif"];

    private readonly HttpClient _http;
    private readonly IFileStorage _storage;
    private readonly ILogger<FaviconFetcher> _logger;

    public FaviconFetcher(HttpClient http, IFileStorage storage, ILogger<FaviconFetcher> logger)
    {
        _http = http;
        _storage = storage;
        _logger = logger;
    }

    public async Task<string?> FetchAsync(string host, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(host)) return null;

        try
        {
            if (!Uri.TryCreate($"https://{host}/", UriKind.Absolute, out var home))
            {
                return null;
            }

            foreach (var candidate in await ResolveCandidatesAsync(home, cancellationToken))
            {
                var key = await TryDownloadAsync(candidate, cancellationToken);
                if (key is not null) return key;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogInformation(ex, "Favicon fetch failed for {Host}", host);
            return null;
        }
    }

    /// <summary>Declared icons from the home page (best first), then the conventional /favicon.ico.</summary>
    private async Task<IReadOnlyList<Uri>> ResolveCandidatesAsync(Uri home, CancellationToken cancellationToken)
    {
        var candidates = new List<Uri>();

        try
        {
            using var document = await JsonLdRecipeParser.OpenDocumentAsync(_http, home, cancellationToken);

            // apple-touch-icon first (usually a clean, larger PNG), then any declared icon.
            AddLinks(document, "link[rel~='apple-touch-icon'], link[rel='apple-touch-icon-precomposed']", home, candidates);
            AddLinks(document, "link[rel~='icon']", home, candidates);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not read home page for favicon links at {Home}", home);
        }

        if (Uri.TryCreate(home, "/favicon.ico", out var fallback) && !candidates.Contains(fallback))
        {
            candidates.Add(fallback);
        }

        return candidates;
    }

    private static void AddLinks(IDocument document, string selector, Uri baseUri, List<Uri> into)
    {
        foreach (var element in document.QuerySelectorAll(selector))
        {
            var href = element.GetAttribute("href");
            if (string.IsNullOrWhiteSpace(href)) continue;
            if (Uri.TryCreate(baseUri, href, out var uri) && uri.Scheme.StartsWith("http") && !into.Contains(uri))
            {
                into.Add(uri);
            }
        }
    }

    private async Task<string?> TryDownloadAsync(Uri url, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            var contentType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
            var extension = ExtensionFor(contentType, url);
            if (extension is null) return null;

            if (response.Content.Headers.ContentLength is { } length && length > MaxBytes) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await _storage.SaveAsync(stream, extension, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Favicon candidate download failed for {Url}", url);
            return null;
        }
    }

    /// <summary>Maps the response to a safe file extension, or null when it isn't an image we accept.</summary>
    private static string? ExtensionFor(string contentType, Uri url)
    {
        if (AllowedTypes.TryGetValue(contentType, out var ext)) return ext;

        // Some servers send .ico as application/octet-stream — trust a known URL extension instead.
        if (string.IsNullOrEmpty(contentType) || contentType.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase))
        {
            var urlExt = Path.GetExtension(url.AbsolutePath).ToLowerInvariant();
            if (KnownExtensions.Contains(urlExt))
            {
                return urlExt == ".jpeg" ? ".jpg" : urlExt;
            }
        }

        return null;
    }
}
