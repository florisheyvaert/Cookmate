using System.Text.RegularExpressions;
using AngleSharp.Dom;
using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Host-specific scraper for dagelijksekost.vrt.be. Prefers schema.org JSON-LD via
/// the shared <see cref="JsonLdRecipeParser"/>, but falls back to the SSR HTML
/// (stable data-testid hooks + Open Graph tags) for pages that ship without Recipe
/// JSON-LD, and tops up steps from the HTML when JSON-LD only carries a couple.
/// Registered against <see cref="Host"/> in <c>IRecipeScraperRegistry</c>.
/// </summary>
public class DagelijkseKostScraper : IHostRecipeScraper
{
    public const string HostName = "dagelijksekost.vrt.be";

    public string Host => HostName;

    private readonly HttpClient _http;

    public DagelijkseKostScraper(HttpClient http)
    {
        _http = http;
    }

    public async Task<ScrapedRecipe> ScrapeAsync(Uri url, CancellationToken cancellationToken)
    {
        using var document = await JsonLdRecipeParser.OpenDocumentAsync(_http, url, cancellationToken);

        var recipeNode = JsonLdRecipeParser.FindRecipeJsonLd(document);

        var scraped = recipeNode is not null
            ? JsonLdRecipeParser.MapRecipe(recipeNode, url)
            : ExtractFromHtml(document, url);

        // Site-specific step fallback: dagelijksekost ships ~2 steps in JSON-LD;
        // the rest live in the SSR HTML.
        if (scraped.Steps.Count < 3)
        {
            var fallback = ExtractSteps(document);
            if (fallback.Count > scraped.Steps.Count)
            {
                scraped = scraped with { Steps = fallback };
            }
        }

        return scraped;
    }

    /// <summary>
    /// Full HTML-based extraction for pages that lack Recipe JSON-LD. Uses Open Graph
    /// tags for title/summary/image, the data-testid hooks for ingredients and steps,
    /// and small regexes against the visible header text for total time and servings.
    /// </summary>
    private static ScrapedRecipe ExtractFromHtml(IDocument doc, Uri url)
    {
        var title = ReadMeta(doc, "og:title");
        if (string.IsNullOrEmpty(title))
        {
            title = doc.QuerySelector("h1")?.TextContent.Trim() ?? "";
        }

        var summary = JsonLdRecipeParser.Truncate(ReadMeta(doc, "og:description"), 2000);
        var imageUrl = ReadMeta(doc, "og:image");
        if (string.IsNullOrWhiteSpace(imageUrl)) imageUrl = null;

        // Each [data-testid='recipe-ingredient'] block contains:
        //   .MuiTypography-bodyLarge   → ingredient name      (e.g. "Gemengd gehakt")
        //   .MuiTypography-titleMedium → amount + unit string (e.g. "300 g", "4 stengels", "1")
        // The site renders each block multiple times for responsive variants — dedupe.
        var ingredients = new List<ScrapedIngredient>();
        var seenIng = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in doc.QuerySelectorAll("[data-testid='recipe-ingredient']"))
        {
            var name = node.QuerySelector(".MuiTypography-bodyLarge")?.TextContent.Trim();
            var amount = node.QuerySelector(".MuiTypography-titleMedium")?.TextContent.Trim();
            if (string.IsNullOrEmpty(name)) continue;

            var key = $"{name}|{amount}".ToLowerInvariant();
            if (!seenIng.Add(key)) continue;

            var line = string.IsNullOrEmpty(amount) ? name : $"{amount} {name}";
            ingredients.Add(IngredientLineParser.Parse(line));
        }

        var steps = ExtractSteps(doc);

        var bodyText = doc.Body?.TextContent ?? "";
        var baseServings = TryParseServings(bodyText) ?? 4;
        var totalTimeMinutes = TryParseTotalTime(bodyText);
        var tags = TryParseRecipeCategory(bodyText);

        return new ScrapedRecipe
        {
            Title = title,
            Summary = summary,
            BaseServings = baseServings,
            TotalTimeMinutes = totalTimeMinutes,
            SourceUrl = url.ToString(),
            ImageUrl = imageUrl,
            Ingredients = ingredients,
            Steps = steps,
            Tags = tags,
        };
    }

    private static string ReadMeta(IDocument doc, string property) =>
        doc.QuerySelector($"meta[property='{property}']")?.GetAttribute("content")?.Trim() ?? "";

    private static int? TryParseServings(string bodyText)
    {
        // Dagelijksekost shows "4 personen" in the recipe header. First match wins.
        var m = Regex.Match(bodyText, @"(\d+)\s*personen", RegexOptions.IgnoreCase);
        return m.Success && int.TryParse(m.Groups[1].Value, out var n) && n > 0 ? n : null;
    }

    private static int? TryParseTotalTime(string bodyText)
    {
        // Header format examples: "Totale tijd 2u", "Totale tijd 45 min", "Totale tijd 1u 30 min".
        // Both branches require an actual time unit so the regex skips bare "Totale tijd"
        // strings (e.g. an i18n translation key in an embedded JSON blob).
        // Also use Matches() so we walk past any false-positive empty matches.
        var pattern = @"Totale\s*tijd\s*(?:(\d+)\s*u(?:ur)?(?:\s*(\d+)\s*min(?:uten)?)?|(\d+)\s*min(?:uten)?)";
        foreach (Match m in Regex.Matches(bodyText, pattern, RegexOptions.IgnoreCase))
        {
            var h = int.TryParse(m.Groups[1].Value, out var hours) ? hours : 0;
            var minA = int.TryParse(m.Groups[2].Value, out var mm1) ? mm1 : 0;
            var minB = int.TryParse(m.Groups[3].Value, out var mm2) ? mm2 : 0;
            var total = h * 60 + minA + minB;
            if (total > 0) return total;
        }
        return null;
    }

    private static IReadOnlyList<string> TryParseRecipeCategory(string bodyText)
    {
        // Dagelijksekost shows "Type gerecht Hoofdgerecht" in the recipe metadata.
        // Capture letters/spaces between "Type gerecht" and the next known label.
        var match = Regex.Match(
            bodyText,
            @"Type\s*gerecht\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]*?)(?=Totale|Bereiding|Tip|Beoordeling|Aantal|Ingredi[eë]nten|Receptinformatie|$)",
            RegexOptions.IgnoreCase);
        if (!match.Success) return Array.Empty<string>();

        var raw = match.Groups[1].Value.Trim();
        if (raw.Length == 0 || raw.Length > 50) return Array.Empty<string>();

        // Lowercased to match the Recipe domain's tag normalisation.
        return new[] { raw.ToLowerInvariant() };
    }

    private static IReadOnlyList<string> ExtractSteps(IDocument document)
    {
        // The site renders each instruction 3–5 times (responsive variants + cook-mode preview).
        // Dedupe by text while preserving first-seen order.
        var nodes = document.QuerySelectorAll("[data-testid='recipe-instruction']");
        var steps = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in nodes)
        {
            var bodyLarge = node.QuerySelector(".MuiTypography-bodyLarge");
            if (bodyLarge is null) continue;
            var text = bodyLarge.TextContent.Trim();
            if (text.Length > 0 && seen.Add(text)) steps.Add(text);
        }
        return steps;
    }
}
