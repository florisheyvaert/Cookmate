using System.Text.RegularExpressions;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;

namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// The generic, site-agnostic recipe-URL discoverer. For each of the source's
/// configured listing URLs it either parses a sitemap (<c>.xml</c>) or an HTML
/// overview page — preferring high-precision schema.org <c>ItemList</c> links and
/// falling back to same-host anchors. Results are absolutised, restricted to the
/// source host, and deduped. A host can override this with a smarter discoverer
/// registered against its host.
/// </summary>
public class ListingPageDiscoverer : IRecipeUrlDiscoverer
{
    private static readonly Regex SitemapLoc = new(@"<loc>\s*(.*?)\s*</loc>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly HttpClient _http;

    public ListingPageDiscoverer(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<Uri>> DiscoverAsync(SuggestionSource source, CancellationToken cancellationToken)
    {
        if (source.ListingUrls.Count == 0)
        {
            // No URLs to crawl and no per-host discoverer took over — make the
            // misconfiguration explicit in the run report instead of silently
            // reporting "0 discovered / Succeeded".
            throw new InvalidOperationException(
                "No listing/overview URLs configured for this source. Edit the source and add at least one " +
                "overview page (or a sitemap .xml) for the harvester to crawl for recipe links.");
        }

        var found = new List<Uri>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var listing in source.ListingUrls)
        {
            if (!Uri.TryCreate(listing, UriKind.Absolute, out var listingUri)) continue;

            var candidates = IsSitemap(listingUri)
                ? await DiscoverFromSitemapAsync(listingUri, cancellationToken)
                : await DiscoverFromHtmlAsync(listingUri, cancellationToken);

            foreach (var raw in candidates)
            {
                if (!Uri.TryCreate(listingUri, raw, out var abs)) continue;
                if (abs.Scheme != Uri.UriSchemeHttp && abs.Scheme != Uri.UriSchemeHttps) continue;
                if (!HostMatch.Matches(abs.Host, source.Host)) continue;

                // Drop the listing pages themselves and fragment-only links.
                var normalised = new UriBuilder(abs) { Fragment = string.Empty }.Uri;
                var key = normalised.GetLeftPart(UriPartial.Query);
                if (key == listingUri.GetLeftPart(UriPartial.Query)) continue;
                if (seen.Add(key)) found.Add(normalised);
            }
        }

        return found;
    }

    private static bool IsSitemap(Uri uri) =>
        uri.AbsolutePath.EndsWith(".xml", StringComparison.OrdinalIgnoreCase);

    private async Task<IReadOnlyList<string>> DiscoverFromSitemapAsync(Uri uri, CancellationToken cancellationToken)
    {
        var xml = await _http.GetStringAsync(uri, cancellationToken);
        return SitemapLoc.Matches(xml).Select(m => m.Groups[1].Value).ToList();
    }

    private async Task<IReadOnlyList<string>> DiscoverFromHtmlAsync(Uri uri, CancellationToken cancellationToken)
    {
        using var document = await JsonLdRecipeParser.OpenDocumentAsync(_http, uri, cancellationToken);

        // Prefer the page's own ItemList (precise); fall back to every anchor.
        var itemList = JsonLdRecipeParser.CollectItemListUrls(document);
        if (itemList.Count > 0) return itemList;

        return document.QuerySelectorAll("a[href]")
            .Select(a => a.GetAttribute("href"))
            .Where(href => !string.IsNullOrWhiteSpace(href))
            .Select(href => href!)
            .ToList();
    }
}
