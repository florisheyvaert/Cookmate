using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp;
using AngleSharp.Dom;
using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

public class JsonLdRecipeScraper : IRecipeScraper
{
    private readonly HttpClient _http;

    public JsonLdRecipeScraper(HttpClient http)
    {
        _http = http;
    }

    public async Task<ScrapedRecipe> ScrapeAsync(Uri url, CancellationToken cancellationToken)
    {
        using var response = await _http.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);

        var context = BrowsingContext.New(Configuration.Default);
        var document = await context.OpenAsync(req => req.Content(stream).Address(url.ToString()), cancellationToken);

        var recipeNode = FindRecipeJsonLd(document);

        ScrapedRecipe scraped;
        if (recipeNode is not null)
        {
            scraped = MapRecipe(recipeNode, url);
        }
        else if (IsDagelijkseKost(url))
        {
            // Some dagelijksekost pages ship without Recipe JSON-LD entirely.
            // Fall back to the SSR HTML, which always carries the recipe content
            // via stable data-testid hooks.
            scraped = ExtractDagelijkseKostFromHtml(document, url);
        }
        else
        {
            throw new InvalidOperationException("No schema.org Recipe JSON-LD found on the page.");
        }

        // Site-specific step fallback: dagelijksekost ships ~2 steps in JSON-LD;
        // the rest live in the SSR HTML.
        if (scraped.Steps.Count < 3 && IsDagelijkseKost(url))
        {
            var fallback = ExtractDagelijkseKostSteps(document);
            if (fallback.Count > scraped.Steps.Count)
            {
                scraped = scraped with { Steps = fallback };
            }
        }

        return scraped;
    }

    private static bool IsDagelijkseKost(Uri url) =>
        url.Host.EndsWith("dagelijksekost.vrt.be", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Full HTML-based extraction for dagelijksekost pages that lack Recipe JSON-LD.
    /// Uses Open Graph tags for title/summary/image, the data-testid hooks for
    /// ingredients and steps, and small regexes against the visible header text
    /// for total time and serving count.
    /// </summary>
    private static ScrapedRecipe ExtractDagelijkseKostFromHtml(IDocument doc, Uri url)
    {
        var title = ReadMeta(doc, "og:title");
        if (string.IsNullOrEmpty(title))
        {
            title = doc.QuerySelector("h1")?.TextContent.Trim() ?? "";
        }

        var summary = Truncate(ReadMeta(doc, "og:description"), 2000);
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

        var steps = ExtractDagelijkseKostSteps(doc);

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

    private static IReadOnlyList<string> ExtractDagelijkseKostSteps(IDocument document)
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

    private static JsonElement? FindRecipeJsonLd(IDocument document)
    {
        foreach (var script in document.QuerySelectorAll("script[type='application/ld+json']"))
        {
            var text = script.TextContent;
            if (string.IsNullOrWhiteSpace(text)) continue;

            JsonDocument? doc;
            try
            {
                doc = JsonDocument.Parse(text);
            }
            catch (JsonException)
            {
                continue;
            }

            using (doc)
            {
                if (TryFindRecipe(doc.RootElement, out var found))
                {
                    // Clone so it survives doc disposal.
                    return JsonDocument.Parse(found.GetRawText()).RootElement;
                }
            }
        }

        return null;
    }

    private static bool TryFindRecipe(JsonElement element, out JsonElement found)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (HasType(element, "Recipe"))
                {
                    found = element;
                    return true;
                }
                if (element.TryGetProperty("@graph", out var graph))
                {
                    return TryFindRecipe(graph, out found);
                }
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    if (TryFindRecipe(item, out found))
                    {
                        return true;
                    }
                }
                break;
        }

        found = default;
        return false;
    }

    private static bool HasType(JsonElement obj, string type)
    {
        if (!obj.TryGetProperty("@type", out var typeProp)) return false;
        return typeProp.ValueKind switch
        {
            JsonValueKind.String => string.Equals(typeProp.GetString(), type, StringComparison.OrdinalIgnoreCase),
            JsonValueKind.Array => typeProp.EnumerateArray()
                .Any(e => e.ValueKind == JsonValueKind.String &&
                          string.Equals(e.GetString(), type, StringComparison.OrdinalIgnoreCase)),
            _ => false,
        };
    }

    private static ScrapedRecipe MapRecipe(JsonElement? maybeRecipe, Uri sourceUrl)
    {
        var recipe = maybeRecipe!.Value;

        return new ScrapedRecipe
        {
            Title = ReadString(recipe, "name") ?? "",
            Summary = Truncate(StripHtml(ReadString(recipe, "description")), 2000),
            BaseServings = ParseYield(ReadString(recipe, "recipeYield")) ?? 4,
            TotalTimeMinutes = ParseDurationMinutes(ReadString(recipe, "totalTime"))
                ?? AddNullable(ParseDurationMinutes(ReadString(recipe, "prepTime")),
                               ParseDurationMinutes(ReadString(recipe, "cookTime"))),
            SourceUrl = sourceUrl.ToString(),
            ImageUrl = ReadFirstImageUrl(recipe),
            Ingredients = ReadStringArray(recipe, "recipeIngredient")
                .Select(IngredientLineParser.Parse)
                .Where(i => !string.IsNullOrWhiteSpace(i.Name))
                .ToList(),
            Steps = ReadInstructions(recipe).ToList(),
            Tags = ReadTags(recipe).ToList(),
        };
    }

    /// <summary>
    /// Pulls tags from <c>recipeCategory</c> (string or array) and <c>keywords</c>
    /// (array or comma-separated string). Lowercases, trims and dedupes — matches the
    /// Recipe domain's normalisation so they roundtrip cleanly.
    /// </summary>
    private static IEnumerable<string> ReadTags(JsonElement recipe)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var raw in CollectTagSource(recipe, "recipeCategory")
            .Concat(CollectTagSource(recipe, "keywords")))
        {
            foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var normalised = part.ToLowerInvariant();
                if (normalised.Length > 0 && normalised.Length <= 50 && seen.Add(normalised))
                {
                    yield return normalised;
                }
            }
        }
    }

    private static IEnumerable<string> CollectTagSource(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var prop)) yield break;

        switch (prop.ValueKind)
        {
            case JsonValueKind.String:
                {
                    var v = prop.GetString();
                    if (!string.IsNullOrWhiteSpace(v)) yield return v;
                    break;
                }
            case JsonValueKind.Array:
                foreach (var item in prop.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                    {
                        var v = item.GetString();
                        if (!string.IsNullOrWhiteSpace(v)) yield return v;
                    }
                }
                break;
        }
    }

    private static string? ReadString(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : null;
    }

    private static IEnumerable<string> ReadStringArray(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var prop)) yield break;

        if (prop.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in prop.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var value = item.GetString();
                    if (!string.IsNullOrWhiteSpace(value)) yield return value.Trim();
                }
            }
        }
        else if (prop.ValueKind == JsonValueKind.String)
        {
            var value = prop.GetString();
            if (!string.IsNullOrWhiteSpace(value)) yield return value.Trim();
        }
    }

    private static IEnumerable<string> ReadInstructions(JsonElement recipe)
    {
        if (!recipe.TryGetProperty("recipeInstructions", out var prop)) yield break;

        switch (prop.ValueKind)
        {
            case JsonValueKind.String:
                {
                    var value = prop.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        foreach (var line in SplitLines(value))
                        {
                            yield return line;
                        }
                    }
                    break;
                }
            case JsonValueKind.Array:
                foreach (var step in WalkInstructions(prop))
                {
                    yield return step;
                }
                break;
        }
    }

    private static IEnumerable<string> WalkInstructions(JsonElement array)
    {
        foreach (var item in array.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var v = item.GetString();
                if (!string.IsNullOrWhiteSpace(v)) yield return Normalise(v);
            }
            else if (item.ValueKind == JsonValueKind.Object)
            {
                if (HasType(item, "HowToSection") && item.TryGetProperty("itemListElement", out var inner))
                {
                    foreach (var step in WalkInstructions(inner)) yield return step;
                }
                else
                {
                    var text = ReadString(item, "text") ?? ReadString(item, "name");
                    if (!string.IsNullOrWhiteSpace(text)) yield return Normalise(text);
                }
            }
        }
    }

    private static string? ReadFirstImageUrl(JsonElement recipe)
    {
        if (!recipe.TryGetProperty("image", out var img)) return null;

        return img.ValueKind switch
        {
            JsonValueKind.String => img.GetString(),
            JsonValueKind.Array => img.EnumerateArray()
                .Select(FirstImageString)
                .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)),
            JsonValueKind.Object => ReadString(img, "url"),
            _ => null,
        };
    }

    private static string? FirstImageString(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Object => ReadString(element, "url"),
            _ => null,
        };

    private static int? ParseYield(string? yieldText)
    {
        if (string.IsNullOrWhiteSpace(yieldText)) return null;
        var match = Regex.Match(yieldText, @"\d+");
        return match.Success && int.TryParse(match.Value, out var n) && n > 0 ? n : null;
    }

    private static string Normalise(string text) =>
        Regex.Replace(StripHtml(text) ?? "", @"\s+", " ").Trim();

    private static string? StripHtml(string? text) =>
        text is null ? null : Regex.Replace(text, "<.*?>", string.Empty);

    private static IEnumerable<string> SplitLines(string text) =>
        text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string? Truncate(string? text, int max) =>
        text is null ? null : text.Length <= max ? text : text[..max];

    /// <summary>
    /// Parses an ISO 8601 duration like <c>PT1H30M</c> or <c>PT80M</c> into total minutes.
    /// Days/seconds are ignored; weeks/months/years aren't expected for cooking times.
    /// </summary>
    private static int? ParseDurationMinutes(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso)) return null;
        if (!iso.StartsWith("PT", StringComparison.Ordinal)) return null;

        var minutes = 0;
        var current = string.Empty;
        for (var i = 2; i < iso.Length; i++)
        {
            var c = iso[i];
            if (char.IsDigit(c))
            {
                current += c;
            }
            else if (c == 'H')
            {
                if (int.TryParse(current, out var h)) minutes += h * 60;
                current = string.Empty;
            }
            else if (c == 'M')
            {
                if (int.TryParse(current, out var m)) minutes += m;
                current = string.Empty;
            }
            else
            {
                current = string.Empty;
            }
        }
        return minutes > 0 ? minutes : null;
    }

    private static int? AddNullable(int? a, int? b) =>
        (a ?? 0) + (b ?? 0) is var sum && sum > 0 ? sum : null;
}
