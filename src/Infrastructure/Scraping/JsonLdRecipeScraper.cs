using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// The generic, site-agnostic recipe scraper: reads schema.org Recipe JSON-LD
/// from the page. This is the default in <see cref="IRecipeScraperRegistry"/>;
/// hosts whose pages need special handling register their own
/// <see cref="IRecipeScraper"/> (e.g. <see cref="DagelijkseKostScraper"/>).
/// </summary>
public class JsonLdRecipeScraper : IRecipeScraper
{
    private readonly HttpClient _http;

    public JsonLdRecipeScraper(HttpClient http)
    {
        _http = http;
    }

    public async Task<ScrapedRecipe> ScrapeAsync(Uri url, CancellationToken cancellationToken)
    {
        using var document = await JsonLdRecipeParser.OpenDocumentAsync(_http, url, cancellationToken);

        var recipeNode = JsonLdRecipeParser.FindRecipeJsonLd(document);
        if (recipeNode is null)
        {
            throw new InvalidOperationException(JsonLdRecipeParser.NoRecipeMessage(document));
        }

        return JsonLdRecipeParser.MapRecipe(recipeNode, url);
    }
}
