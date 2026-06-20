using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// A recipe scraper bound to a specific host. The registry keys these by
/// <see cref="Host"/> and falls back to the generic scraper for everything else.
/// </summary>
public interface IHostRecipeScraper : IRecipeScraper
{
    /// <summary>Bare host this scraper handles, e.g. <c>dagelijksekost.vrt.be</c>.</summary>
    string Host { get; }
}

/// <summary>
/// A recipe-URL discoverer bound to a specific host (e.g. a sitemap- or API-based
/// override of the generic listing-page crawl).
/// </summary>
public interface IHostRecipeUrlDiscoverer : IRecipeUrlDiscoverer
{
    string Host { get; }
}
