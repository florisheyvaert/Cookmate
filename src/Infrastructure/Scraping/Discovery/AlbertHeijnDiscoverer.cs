namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// Discovers Albert Heijn Allerhande recipes from the site's dedicated recipes sitemap
/// (a flat urlset of <c>/allerhande/recept/&lt;id&gt;/&lt;slug&gt;</c> pages). Works with just
/// the host configured. Note: AH serves recipe HTML only to browser-like clients, so the
/// scraper sends a browser User-Agent (see Infrastructure DI).
/// </summary>
public class AlbertHeijnDiscoverer : SitemapHostDiscoverer
{
    public const string HostName = "ah.be";

    public AlbertHeijnDiscoverer(HttpClient http) : base(http) { }

    public override string Host => HostName;

    protected override IReadOnlyList<string> DefaultSitemapUrls =>
        new[] { "https://www.ah.be/sitemaps/entities/allerhande/recipes.xml" };

    // The recipes sitemap is a flat urlset — no sub-sitemaps to recurse.
    protected override bool IsRecipeSubSitemap(string loc) => false;

    protected override bool IsRecipeUrl(Uri uri) =>
        HostMatch.Matches(uri.Host, HostName)
        && uri.AbsolutePath.Contains("/allerhande/recept/", StringComparison.OrdinalIgnoreCase);
}
