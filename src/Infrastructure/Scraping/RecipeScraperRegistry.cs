using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Resolves the scraper for a host: a registered <see cref="IHostRecipeScraper"/>
/// when one matches (by host or subdomain), otherwise the generic LD+JSON scraper.
/// Mirrors <see cref="GroceryStoreRegistry"/>.
/// </summary>
public class RecipeScraperRegistry : IRecipeScraperRegistry
{
    private readonly IRecipeScraper _generic;
    private readonly IReadOnlyList<IHostRecipeScraper> _hostScrapers;

    public RecipeScraperRegistry(JsonLdRecipeScraper generic, IEnumerable<IHostRecipeScraper> hostScrapers)
    {
        _generic = generic;
        _hostScrapers = hostScrapers.ToList();
    }

    public IRecipeScraper For(string host)
    {
        if (string.IsNullOrWhiteSpace(host)) return _generic;

        var normalised = host.Trim().ToLowerInvariant();
        foreach (var scraper in _hostScrapers)
        {
            if (HostMatch.Matches(normalised, scraper.Host)) return scraper;
        }

        return _generic;
    }
}
