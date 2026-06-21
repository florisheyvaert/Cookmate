using System.Text.RegularExpressions;
using Cookmate.Domain.Entities;

namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// Base for per-host discoverers that find recipe URLs from a site's XML sitemap(s).
/// Lets a source be configured with just its host: the discoverer knows the site's
/// default sitemap entry point, recurses sitemap indexes into the recipe sub-sitemaps,
/// and keeps only the recipe detail pages. If the user does configure listing URLs,
/// those are used as the sitemap entry points instead.
/// </summary>
public abstract class SitemapHostDiscoverer : IHostRecipeUrlDiscoverer
{
    private const int MaxDepth = 3;

    private static readonly Regex LocRegex = new(@"<loc>\s*(.*?)\s*</loc>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    protected SitemapHostDiscoverer(HttpClient http)
    {
        Http = http;
    }

    protected HttpClient Http { get; }

    public abstract string Host { get; }

    /// <summary>Sitemap entry point(s) used when the source has no listing URLs configured.</summary>
    protected abstract IReadOnlyList<string> DefaultSitemapUrls { get; }

    /// <summary>True when a sitemap <c>&lt;loc&gt;</c> points at a (sub-)sitemap of recipes to recurse into.</summary>
    protected abstract bool IsRecipeSubSitemap(string loc);

    /// <summary>True when a <c>&lt;loc&gt;</c> is a recipe detail page to keep.</summary>
    protected abstract bool IsRecipeUrl(Uri uri);

    public async Task<IReadOnlyList<Uri>> DiscoverAsync(SuggestionSource source, CancellationToken cancellationToken)
    {
        var entries = source.ListingUrls.Count > 0 ? source.ListingUrls : DefaultSitemapUrls;

        var results = new List<Uri>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            await CollectAsync(entry, results, seen, 0, cancellationToken);
        }

        return results;
    }

    private async Task CollectAsync(string sitemapUrl, List<Uri> results, HashSet<string> seen, int depth, CancellationToken cancellationToken)
    {
        if (depth > MaxDepth) return;

        var xml = await Http.GetStringAsync(sitemapUrl, cancellationToken);

        foreach (var loc in Locs(xml))
        {
            if (IsRecipeSubSitemap(loc))
            {
                await CollectAsync(loc, results, seen, depth + 1, cancellationToken);
            }
            else if (Uri.TryCreate(loc, UriKind.Absolute, out var uri) && IsRecipeUrl(uri))
            {
                var key = uri.GetLeftPart(UriPartial.Path);
                if (seen.Add(key)) results.Add(uri);
            }
        }
    }

    private static IEnumerable<string> Locs(string xml) =>
        LocRegex.Matches(xml).Select(m => m.Groups[1].Value);
}
