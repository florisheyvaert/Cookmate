using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// Finds candidate recipe page URLs for a source. The generic implementation
/// crawls the source's configured <see cref="SuggestionSource.ListingUrls"/> and
/// extracts recipe links; a host can override this with a sitemap- or API-based
/// discoverer.
/// </summary>
public interface IRecipeUrlDiscoverer
{
    Task<IReadOnlyList<Uri>> DiscoverAsync(SuggestionSource source, CancellationToken cancellationToken);
}

/// <summary>Picks the right <see cref="IRecipeUrlDiscoverer"/> for a host (generic fallback + per-host override).</summary>
public interface IRecipeUrlDiscovererRegistry
{
    IRecipeUrlDiscoverer For(string host);
}
