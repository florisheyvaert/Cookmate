namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// Picks the right <see cref="IRecipeScraper"/> for a host. The generic
/// schema.org LD+JSON scraper is the default; a host can register a more
/// specific implementation (e.g. one that reads SSR HTML) that takes precedence.
/// Mirrors <see cref="IGroceryStoreRegistry"/>.
/// </summary>
public interface IRecipeScraperRegistry
{
    /// <summary>Returns the host-specific scraper if one is registered, otherwise the generic one.</summary>
    IRecipeScraper For(string host);
}
