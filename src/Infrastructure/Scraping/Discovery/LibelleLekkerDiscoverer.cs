namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// Discovers libelle-lekker.be recipes from its sitemap index (which fans out into
/// <c>sitemap-recipe-N.xml</c> sub-sitemaps of <c>/bekijk-recept/&lt;id&gt;/&lt;slug&gt;</c>
/// pages). Works with just the host configured.
/// </summary>
public class LibelleLekkerDiscoverer : SitemapHostDiscoverer
{
    public LibelleLekkerDiscoverer(HttpClient http) : base(http) { }

    public override string Host => LibelleLekkerScraper.HostName;

    protected override IReadOnlyList<string> DefaultSitemapUrls =>
        new[] { "https://www.libelle-lekker.be/sitemap.xml" };

    protected override bool IsRecipeSubSitemap(string loc) =>
        loc.Contains("sitemap-recipe", StringComparison.OrdinalIgnoreCase);

    protected override bool IsRecipeUrl(Uri uri) =>
        HostMatch.Matches(uri.Host, Host)
        && uri.AbsolutePath.Contains("/bekijk-recept/", StringComparison.OrdinalIgnoreCase);
}
