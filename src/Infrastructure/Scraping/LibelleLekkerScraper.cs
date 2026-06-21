using System.Globalization;
using System.Text.Json;
using AngleSharp.Dom;
using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Host-specific scraper for libelle-lekker.be. Title/summary/image/steps/time come
/// from the page's schema.org JSON-LD (via the shared parser), but that JSON-LD omits
/// ingredients — those live in the <c>data-ingredient-groups</c> attribute on the
/// <c>#react-recipe-ingredients</c> element (structured: quantity / unitName /
/// ingredientName / info), with the base serving count in <c>data-servings</c>.
/// Recipe pages sit behind a silent SSO bounce, so the scraper HttpClient must follow
/// redirects and persist cookies (configured in Infrastructure DI).
/// </summary>
public class LibelleLekkerScraper : IHostRecipeScraper
{
    public const string HostName = "libelle-lekker.be";

    public string Host => HostName;

    private readonly HttpClient _http;

    public LibelleLekkerScraper(HttpClient http)
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

        var scraped = JsonLdRecipeParser.MapRecipe(recipeNode, url);

        var ingredients = ExtractIngredients(document);
        if (ingredients.Count > 0)
        {
            scraped = scraped with { Ingredients = ingredients };
        }

        if (ReadServings(document) is { } servings)
        {
            scraped = scraped with { BaseServings = servings };
        }

        return scraped;
    }

    private static List<ScrapedIngredient> ExtractIngredients(IDocument document)
    {
        var result = new List<ScrapedIngredient>();

        var json = document.QuerySelector("#react-recipe-ingredients")?.GetAttribute("data-ingredient-groups");
        if (string.IsNullOrWhiteSpace(json)) return result;

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            return result;
        }

        using (doc)
        {
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;

            foreach (var group in doc.RootElement.EnumerateArray())
            {
                if (!group.TryGetProperty("ingredients", out var ings) || ings.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var item in ings.EnumerateArray())
                {
                    var name = ReadString(item, "ingredientName") ?? ReadNestedName(item);
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    result.Add(new ScrapedIngredient
                    {
                        Name = name.Trim(),
                        Amount = ParseDecimal(ReadString(item, "quantity")),
                        Unit = Blank(ReadString(item, "unitName")),
                        Notes = Blank(ReadString(item, "info")),
                    });
                }
            }
        }

        return result;
    }

    private static int? ReadServings(IDocument document)
    {
        var raw = document.QuerySelector("[data-servings]")?.GetAttribute("data-servings");
        return int.TryParse(raw, out var n) && n > 0 ? n : null;
    }

    private static string? ReadNestedName(JsonElement item)
    {
        if (!item.TryGetProperty("ingredient", out var ing) || ing.ValueKind != JsonValueKind.Object) return null;
        return ReadString(ing, "nameDisplay") ?? ReadString(ing, "nameSelect");
    }

    private static string? ReadString(JsonElement obj, string property)
    {
        if (obj.ValueKind != JsonValueKind.Object || !obj.TryGetProperty(property, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : null;
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
