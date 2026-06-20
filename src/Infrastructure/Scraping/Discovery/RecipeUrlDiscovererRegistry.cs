using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping.Discovery;

/// <summary>
/// Resolves the URL discoverer for a host: a registered per-host override (e.g.
/// sitemap/API based) when one matches, otherwise the generic listing-page crawl.
/// </summary>
public class RecipeUrlDiscovererRegistry : IRecipeUrlDiscovererRegistry
{
    private readonly IRecipeUrlDiscoverer _generic;
    private readonly IReadOnlyList<IHostRecipeUrlDiscoverer> _hostDiscoverers;

    public RecipeUrlDiscovererRegistry(
        ListingPageDiscoverer generic, IEnumerable<IHostRecipeUrlDiscoverer> hostDiscoverers)
    {
        _generic = generic;
        _hostDiscoverers = hostDiscoverers.ToList();
    }

    public IRecipeUrlDiscoverer For(string host)
    {
        if (string.IsNullOrWhiteSpace(host)) return _generic;

        var normalised = host.Trim().ToLowerInvariant();
        foreach (var discoverer in _hostDiscoverers)
        {
            if (HostMatch.Matches(normalised, discoverer.Host)) return discoverer;
        }

        return _generic;
    }
}
