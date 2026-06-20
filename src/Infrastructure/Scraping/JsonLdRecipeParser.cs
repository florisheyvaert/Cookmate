using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp;
using AngleSharp.Dom;
using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Shared, site-agnostic schema.org Recipe JSON-LD parsing. Both the generic
/// <see cref="JsonLdRecipeScraper"/> and per-host scrapers (e.g.
/// <see cref="DagelijkseKostScraper"/>) build on these helpers so the LD+JSON
/// path lives in exactly one place.
/// </summary>
internal static class JsonLdRecipeParser
{
    /// <summary>Fetches the URL and opens it as an AngleSharp document.</summary>
    public static async Task<IDocument> OpenDocumentAsync(HttpClient http, Uri url, CancellationToken cancellationToken)
    {
        using var response = await http.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);

        var context = BrowsingContext.New(Configuration.Default);
        return await context.OpenAsync(req => req.Content(stream).Address(url.ToString()), cancellationToken);
    }

    /// <summary>
    /// Builds a diagnostic message for when no Recipe JSON-LD was found, including the
    /// page title — if it reads like a login/consent page, the site gated the recipe
    /// (e.g. a session/cookie handshake didn't complete).
    /// </summary>
    public static string NoRecipeMessage(IDocument document)
    {
        var title = document.Title?.Trim();
        return string.IsNullOrEmpty(title)
            ? "No schema.org Recipe JSON-LD found on the page."
            : $"No schema.org Recipe JSON-LD found on the page (page title: \"{title}\").";
    }

    public static JsonElement? FindRecipeJsonLd(IDocument document)
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

    /// <summary>
    /// Collects recipe URLs advertised by schema.org <c>ItemList</c> JSON-LD on a
    /// listing/overview page. High-precision when present (the site itself lists the
    /// items); callers fall back to anchor scraping when it returns nothing.
    /// </summary>
    public static IReadOnlyList<string> CollectItemListUrls(IDocument document)
    {
        var urls = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var script in document.QuerySelectorAll("script[type='application/ld+json']"))
        {
            var text = script.TextContent;
            if (string.IsNullOrWhiteSpace(text)) continue;

            JsonDocument doc;
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
                foreach (var url in WalkItemLists(doc.RootElement))
                {
                    if (seen.Add(url)) urls.Add(url);
                }
            }
        }

        return urls;
    }

    private static IEnumerable<string> WalkItemLists(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (HasType(element, "ItemList") && element.TryGetProperty("itemListElement", out var list))
                {
                    foreach (var url in ReadListItemUrls(list)) yield return url;
                }
                if (element.TryGetProperty("@graph", out var graph))
                {
                    foreach (var url in WalkItemLists(graph)) yield return url;
                }
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    foreach (var url in WalkItemLists(item)) yield return url;
                }
                break;
        }
    }

    private static IEnumerable<string> ReadListItemUrls(JsonElement list)
    {
        if (list.ValueKind != JsonValueKind.Array) yield break;

        foreach (var element in list.EnumerateArray())
        {
            if (element.ValueKind == JsonValueKind.String)
            {
                var s = element.GetString();
                if (!string.IsNullOrWhiteSpace(s)) yield return s;
            }
            else if (element.ValueKind == JsonValueKind.Object)
            {
                // ListItem → url, or item → (url | @id), or a bare url/@id.
                var url = ReadString(element, "url");
                if (string.IsNullOrWhiteSpace(url) && element.TryGetProperty("item", out var item))
                {
                    url = item.ValueKind == JsonValueKind.String
                        ? item.GetString()
                        : ReadString(item, "url") ?? ReadString(item, "@id");
                }
                url ??= ReadString(element, "@id");
                if (!string.IsNullOrWhiteSpace(url)) yield return url;
            }
        }
    }

    public static bool HasType(JsonElement obj, string type)
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

    public static ScrapedRecipe MapRecipe(JsonElement? maybeRecipe, Uri sourceUrl)
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

    public static string Normalise(string text) =>
        Regex.Replace(StripHtml(text) ?? "", @"\s+", " ").Trim();

    public static string? StripHtml(string? text) =>
        text is null ? null : Regex.Replace(text, "<.*?>", string.Empty);

    private static IEnumerable<string> SplitLines(string text) =>
        text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static string? Truncate(string? text, int max) =>
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
