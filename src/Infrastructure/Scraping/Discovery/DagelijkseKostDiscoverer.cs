namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// Discovers dagelijksekost.vrt.be recipes via its sitemap. The site is a JS-rendered
/// SPA (overview pages carry no recipe links in static HTML), but its sitemap index
/// points at a recipes sub-sitemap of ~3500 <c>/gerechten/&lt;slug&gt;</c> pages — so the
/// source works with just its host configured.
/// </summary>
public class DagelijkseKostDiscoverer : SitemapHostDiscoverer
{
    public DagelijkseKostDiscoverer(HttpClient http) : base(http) { }

    public override string Host => DagelijkseKostScraper.HostName;

    protected override IReadOnlyList<string> DefaultSitemapUrls => new[] { $"https://{Host}/sitemap.xml" };

    protected override bool IsRecipeSubSitemap(string loc) =>
        loc.Contains("/sitemaps/recipes/", StringComparison.OrdinalIgnoreCase);

    protected override bool IsRecipeUrl(Uri uri) =>
        HostMatch.Matches(uri.Host, Host)
        && uri.AbsolutePath.StartsWith("/gerechten/", StringComparison.OrdinalIgnoreCase)
        && !uri.AbsolutePath.StartsWith("/gerechten/zoeken", StringComparison.OrdinalIgnoreCase);
}
