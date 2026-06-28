using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Playwright;

namespace Cookmate.Infrastructure.Shopping;

/// <summary>
/// Promotions sourced from the public ah.be/bonus website, which shows a curated weekly
/// bonus folder that differs from (and is smaller than) the mobile API's raw assortment.
/// The site's data comes from a GraphQL endpoint (<c>/gql</c>, operation
/// <c>bonusCategories</c>) gated by Akamai bot-management — plain HTTP is 403'd even with
/// cookies (TLS fingerprinting), so we drive a headless Chromium that passes the challenge,
/// then issue same-origin in-page fetches for each visible week (this week + next).
///
/// Best-effort, like the other promo paths: any failure returns what was gathered so far
/// (empty at worst) and never throws.
/// </summary>
public sealed class AlbertHeijnWebPromotionSource : IStorePromotionSource
{
    private const string BonusUrl = "https://www.ah.be/bonus";
    private const string GqlPath = "/gql";
    private const string UserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ILogger<AlbertHeijnWebPromotionSource> _logger;

    public AlbertHeijnWebPromotionSource(ILogger<AlbertHeijnWebPromotionSource> logger)
    {
        _logger = logger;
    }

    public string Code => AlbertHeijnStore.StoreCode;

    public async Task<IReadOnlyList<StorePromotion>> GetPromotionsAsync(CancellationToken cancellationToken)
    {
        var promotions = new List<StorePromotion>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Chromium.LaunchAsync(new()
            {
                Headless = true,
                // Use the full Chrome build, not Playwright's headless-shell — Akamai's
                // bot-manager fingerprints the shell and 403s its gql calls. The flag hides
                // navigator.webdriver, which the bot-manager also checks.
                Channel = "chrome",
                Args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
            });
            await using var context = await browser.NewContextAsync(new() { UserAgent = UserAgent });
            var page = await context.NewPageAsync();

            // Loading the page acquires the Akamai session and fires the first bonusCategories
            // query — we grab its request (the GraphQL document + the live week's variables).
            // Don't wait for network-idle: the page keeps connections open (analytics/polling)
            // so it never idles; readiness is the bonusCategories request firing instead.
            var requestTask = page.WaitForRequestAsync(
                r => r.Url.Contains(GqlPath) && (r.PostData ?? "").Contains("\"bonusCategories\""),
                new() { Timeout = 60_000 });
            await page.GotoAsync(BonusUrl, new() { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 60_000 });
            var request = await requestTask;

            var body = JsonNode.Parse(request.PostData ?? "{}")!;
            var query = body["query"]?.GetValue<string>();
            var baseInput = body["variables"]?["input"] as JsonObject;
            if (query is null || baseInput is null) return promotions;

            var currentStart = ParseDate(baseInput["periodStart"]?.GetValue<string>());
            if (currentStart is null) return promotions;

            // This week + next. The site shows at most these two; a not-yet-published next
            // week simply returns no promotions and is skipped.
            for (var offset = 0; offset <= 7; offset += 7)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var from = currentStart.Value.AddDays(offset);
                var to = from.AddDays(6);
                if (to < today) continue;

                var json = await FetchWeekAsync(page, query, baseInput, from, to, cancellationToken);
                if (json is null) continue;

                var response = JsonSerializer.Deserialize<BonusCategoriesResponse>(json, JsonOptions);
                MapInto(promotions, response, from, to);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH website bonus fetch failed");
        }

        return promotions;
    }

    // Re-issues the bonusCategories query for a given week from inside the page (same origin,
    // so the Akamai cookies + TLS context come for free). Returns the raw JSON body.
    private static async Task<string?> FetchWeekAsync(
        IPage page, string query, JsonObject baseInput, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var input = (JsonObject)baseInput.DeepClone();
        input["periodStart"] = from.ToString("yyyy-MM-dd");
        input["periodEnd"] = to.ToString("yyyy-MM-dd");
        input["weekNumber"] = ISOWeek.GetWeekOfYear(from.ToDateTime(TimeOnly.MinValue));

        var payload = new JsonObject
        {
            ["operationName"] = "bonusCategories",
            ["variables"] = new JsonObject { ["input"] = input },
            ["query"] = query,
        }.ToJsonString();

        // The function takes the request body as its argument and returns the response text.
        const string js = """
            async (payload) => {
              const r = await fetch('/gql', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'accept': 'application/graphql-response+json,application/json;q=0.9',
                  'x-client-name': 'ah-bonus',
                  'x-client-platform-type': 'Web',
                  'x-client-version': '1.34.43',
                },
                body: payload,
              });
              return await r.text();
            }
            """;

        ct.ThrowIfCancellationRequested();
        return await page.EvaluateAsync<string>(js, payload);
    }

    private static void MapInto(List<StorePromotion> sink, BonusCategoriesResponse? response, DateOnly from, DateOnly to)
    {
        var categories = response?.Data?.BonusCategories;
        if (categories is null) return;

        foreach (var category in categories)
        {
            if (category.Promotions is null) continue;
            foreach (var promo in category.Promotions)
            {
                var mapped = ToPromotion(promo, from, to);
                if (mapped is not null) sink.Add(mapped);
            }
        }
    }

    private static StorePromotion? ToPromotion(BonusPromotion promo, DateOnly from, DateOnly to)
    {
        if (string.IsNullOrWhiteSpace(promo.Id) || string.IsNullOrWhiteSpace(promo.Title)) return null;

        return new StorePromotion(
            // Website promos are bonus "groups", not webshop SKUs — synthetic, cart-unlinkable
            // identity (CanonicalUrl null), matching by name like the mobile combi tiles.
            Sku: promo.Id,
            Name: promo.Title.Trim(),
            BrandOrSubtitle: FirstNonEmpty(promo.Subtitle, promo.Category),
            PackSize: new Quantity(0, promo.SalesUnitSize ?? string.Empty),
            OriginalPrice: promo.Price?.Was?.Amount,
            PromoPrice: promo.Price?.Now?.Amount,
            DiscountLabel: BuildLabel(promo.PromotionLabels),
            Currency: "EUR",
            ImageUrl: SelectImage(promo.Images),
            CanonicalUrl: null,
            ValidFrom: from,
            ValidTo: to);
    }

    // "1+2 gratis", "voor 1.29", "gratis levering bij 12 euro" — the label's parts joined.
    private static string? BuildLabel(List<BonusLabel>? labels)
    {
        var label = labels?.FirstOrDefault();
        if (label is null) return null;
        var parts = new[] { label.TopText, label.CenterText, label.BottomText }
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!.Trim());
        var text = string.Join(' ', parts);
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string? SelectImage(List<BonusImage>? images)
    {
        if (images is null || images.Count == 0) return null;
        var pick = images
            .Where(i => !string.IsNullOrWhiteSpace(i.Url))
            .OrderBy(i => Math.Abs((i.Width ?? 0) - 400))
            .FirstOrDefault();
        return pick?.Url ?? images[0].Url;
    }

    private static string? FirstNonEmpty(string? a, string? b) =>
        !string.IsNullOrWhiteSpace(a) ? a.Trim() : (!string.IsNullOrWhiteSpace(b) ? b!.Trim() : null);

    private static DateOnly? ParseDate(string? raw) =>
        DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : null;

    // ─── bonusCategories response shape ────────────────────────────────────
    private sealed record BonusCategoriesResponse
    {
        public BonusData? Data { get; init; }
    }

    private sealed record BonusData
    {
        public List<BonusCategory>? BonusCategories { get; init; }
    }

    private sealed record BonusCategory
    {
        public List<BonusPromotion>? Promotions { get; init; }
    }

    private sealed record BonusPromotion
    {
        public string? Id { get; init; }
        public string? Title { get; init; }
        public string? Subtitle { get; init; }
        public string? Category { get; init; }
        public string? SalesUnitSize { get; init; }
        public string? PromotionType { get; init; }
        public List<BonusLabel>? PromotionLabels { get; init; }
        public List<BonusImage>? Images { get; init; }
        public BonusPrice? Price { get; init; }
    }

    private sealed record BonusLabel
    {
        public string? TopText { get; init; }
        public string? CenterText { get; init; }
        public string? BottomText { get; init; }
    }

    private sealed record BonusImage
    {
        public string? Url { get; init; }
        public int? Width { get; init; }
    }

    private sealed record BonusPrice
    {
        public BonusMoney? Now { get; init; }
        public BonusMoney? Was { get; init; }
    }

    private sealed record BonusMoney
    {
        public decimal? Amount { get; init; }
    }
}
