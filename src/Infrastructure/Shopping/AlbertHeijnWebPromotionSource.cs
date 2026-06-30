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
/// The site's data comes from a GraphQL endpoint (<c>/gql</c>) gated by Akamai bot-management
/// — plain HTTP is 403'd even with cookies (TLS fingerprinting), so we drive a headless
/// Chrome that passes the challenge, then issue same-origin in-page fetches.
///
/// Two levels are pulled per visible week (this week + next):
///  • <c>bonusCategories</c> → the category-ordered list of bonus "groups" (e.g. "Hak
///    380-550 gram", "2e gratis") — these become top-level promo tiles.
///  • <c>bonusPromotion(id)</c> → the member products inside each group, with real webshop
///    SKUs (cart-linkable) and clean names — stored as child rows under the group.
///
/// Best-effort: any failure returns what was gathered so far (empty at worst), never throws.
/// </summary>
public sealed class AlbertHeijnWebPromotionSource : IStorePromotionSource
{
    private const string BonusUrl = "https://www.ah.be/bonus";
    private const string SiteRoot = "https://www.ah.be";
    private const string GqlPath = "/gql";
    private const string UserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    // The page runs this to POST a GraphQL operation same-origin (carrying the Akamai context).
    private const string GqlJs = """
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

            var catBody = JsonNode.Parse(request.PostData ?? "{}")!;
            var catQuery = catBody["query"]?.GetValue<string>();
            var catInput = catBody["variables"]?["input"] as JsonObject;
            if (catQuery is null || catInput is null) return promotions;

            var currentStart = ParseDate(catInput["periodStart"]?.GetValue<string>());
            if (currentStart is null) return promotions;

            // Pull each visible week's groups (this week + next; a not-yet-published next week
            // simply returns nothing and is skipped).
            var weeks = new List<(DateOnly From, DateOnly To, List<BonusPromotion> Groups)>();
            for (var offset = 0; offset <= 7; offset += 7)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var from = currentStart.Value.AddDays(offset);
                var to = from.AddDays(6);
                if (to < today) continue;

                var json = await GqlAsync(page, "bonusCategories", new JsonObject { ["input"] = WeekInput(catInput, from, to) }, catQuery, cancellationToken);
                var response = json is null ? null : JsonSerializer.Deserialize<BonusCategoriesResponse>(json, JsonOptions);
                var groups = response?.Data?.BonusCategories?
                    .Where(c => c.Promotions is not null)
                    .SelectMany(c => c.Promotions!)
                    .ToList() ?? [];
                weeks.Add((from, to, groups));
            }

            // The member products live behind a per-group bonusPromotion query — capture it
            // once from any real group page (it isn't fired on /bonus itself).
            var sample = weeks.SelectMany(w => w.Groups).FirstOrDefault(g => g.ProductCount > 0 && !string.IsNullOrWhiteSpace(g.WebPath));
            var member = sample is null ? null : await CaptureBonusPromotionAsync(page, sample.WebPath!, cancellationToken);

            foreach (var (from, to, groups) in weeks)
            {
                foreach (var group in groups)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var tile = ToGroupPromotion(group, from, to);
                    if (tile is null) continue;
                    promotions.Add(tile);

                    if (member is null || group.ProductCount is null or 0 || string.IsNullOrWhiteSpace(group.Id)) continue;

                    var members = await FetchMembersAsync(page, member.Value.Query, member.Value.Vars, group.Id!, from, to, cancellationToken);
                    foreach (var p in members)
                    {
                        var mapped = ToMemberPromotion(p, group, from, to);
                        if (mapped is not null) promotions.Add(mapped);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH website bonus fetch failed");
        }

        return promotions;
    }

    // bonusCategories takes its variables under `input`; clone the live template and set the week.
    private static JsonObject WeekInput(JsonObject template, DateOnly from, DateOnly to)
    {
        var input = (JsonObject)template.DeepClone();
        input["periodStart"] = from.ToString("yyyy-MM-dd");
        input["periodEnd"] = to.ToString("yyyy-MM-dd");
        input["weekNumber"] = ISOWeek.GetWeekOfYear(from.ToDateTime(TimeOnly.MinValue));
        return input;
    }

    private static async Task<string?> GqlAsync(
        IPage page, string operationName, JsonObject variables, string query, CancellationToken ct)
    {
        var payload = new JsonObject
        {
            ["operationName"] = operationName,
            ["variables"] = variables,
            ["query"] = query,
        }.ToJsonString();

        ct.ThrowIfCancellationRequested();
        return await page.EvaluateAsync<string>(GqlJs, payload);
    }

    // Navigates to a group page so its bonusPromotion request fires, capturing the GraphQL
    // document + the variable template (property codes etc.) to reuse for every group.
    private async Task<(string Query, JsonObject Vars)?> CaptureBonusPromotionAsync(IPage page, string webPath, CancellationToken ct)
    {
        try
        {
            var url = webPath.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? webPath : SiteRoot + webPath;
            var requestTask = page.WaitForRequestAsync(
                r => r.Url.Contains(GqlPath) && (r.PostData ?? "").Contains("\"bonusPromotion\""),
                new() { Timeout = 30_000 });
            await page.GotoAsync(url, new() { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 60_000 });
            var request = await requestTask;

            var body = JsonNode.Parse(request.PostData ?? "{}")!;
            var query = body["query"]?.GetValue<string>();
            var vars = body["variables"] as JsonObject;
            return query is null || vars is null ? null : (query, vars);
        }
        catch (Exception ex)
        {
            _logger.LogInformation(ex, "AH bonusPromotion query capture failed — listing groups without their products");
            return null;
        }
    }

    private async Task<IReadOnlyList<BonusMemberProduct>> FetchMembersAsync(
        IPage page, string query, JsonObject varsTemplate, string groupId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        try
        {
            var vars = (JsonObject)varsTemplate.DeepClone();
            vars["id"] = groupId;
            vars["periodStart"] = from.ToString("yyyy-MM-dd");
            vars["periodEnd"] = to.ToString("yyyy-MM-dd");

            var json = await GqlAsync(page, "bonusPromotion", vars, query, ct);
            var response = json is null ? null : JsonSerializer.Deserialize<BonusPromotionResponse>(json, JsonOptions);
            return response?.Data?.BonusPromotions?.FirstOrDefault()?.Products ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogInformation(ex, "AH member fetch failed for group {GroupId}", groupId);
            return [];
        }
    }

    // A bonus group as a (non-cart-linkable) tile; its members carry the real SKUs.
    private static StorePromotion? ToGroupPromotion(BonusPromotion promo, DateOnly from, DateOnly to)
    {
        if (string.IsNullOrWhiteSpace(promo.Id) || string.IsNullOrWhiteSpace(promo.Title)) return null;

        return new StorePromotion(
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
            ValidTo: to,
            Category: Clean(promo.Category),
            GroupSku: null);
    }

    private static StorePromotion? ToMemberPromotion(BonusMemberProduct p, BonusPromotion group, DateOnly from, DateOnly to)
    {
        if (p.Id is null or 0 || string.IsNullOrWhiteSpace(p.Title)) return null;

        var sku = p.Id.Value.ToString();
        var canonical = string.IsNullOrWhiteSpace(p.WebPath)
            ? $"{SiteRoot}/producten/product/wi{sku}"
            : SiteRoot + p.WebPath;
        // The product's own discount text ("2e gratis") if present, else the group's deal label.
        var label = Clean(p.PriceV2?.Discount?.Description) ?? BuildLabel(group.PromotionLabels);

        return new StorePromotion(
            Sku: sku,
            Name: p.Title.Trim(),
            BrandOrSubtitle: FirstNonEmpty(p.Brand, group.Category),
            PackSize: new Quantity(0, p.SalesUnitSize ?? string.Empty),
            OriginalPrice: p.PriceV2?.Was?.Amount,
            PromoPrice: p.PriceV2?.Now?.Amount,
            DiscountLabel: label,
            Currency: "EUR",
            ImageUrl: SelectMemberImage(p.ImagePack),
            CanonicalUrl: canonical,
            ValidFrom: from,
            ValidTo: to,
            Category: Clean(group.Category),
            GroupSku: group.Id);
    }

    // "1+2 gratis", "voor 1.29", "gratis levering bij 12 euro" — the label's parts joined.
    private static string? BuildLabel(List<BonusLabel>? labels)
    {
        var label = labels?.FirstOrDefault();
        if (label is null) return null;
        var text = string.Join(' ', new[] { label.TopText, label.CenterText, label.BottomText }
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!.Trim()));
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

    private static string? SelectMemberImage(List<ImagePack>? pack)
    {
        if (pack is null) return null;
        foreach (var img in pack)
        {
            var url = img.Medium?.Url ?? img.Small?.Url;
            if (!string.IsNullOrWhiteSpace(url)) return url;
        }
        return null;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string? FirstNonEmpty(string? a, string? b) => Clean(a) ?? Clean(b);

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

    // ─── bonusPromotion (group detail) response shape ──────────────────────
    private sealed record BonusPromotionResponse
    {
        public BonusPromotionData? Data { get; init; }
    }

    private sealed record BonusPromotionData
    {
        public List<BonusPromotion>? BonusPromotions { get; init; }
    }

    private sealed record BonusPromotion
    {
        public string? Id { get; init; }
        public string? Title { get; init; }
        public string? Subtitle { get; init; }
        public string? Category { get; init; }
        public string? SalesUnitSize { get; init; }
        public string? PromotionType { get; init; }
        public int? ProductCount { get; init; }
        public string? WebPath { get; init; }
        public List<BonusLabel>? PromotionLabels { get; init; }
        public List<BonusImage>? Images { get; init; }
        public BonusPrice? Price { get; init; }
        public List<BonusMemberProduct>? Products { get; init; }
    }

    private sealed record BonusMemberProduct
    {
        public long? Id { get; init; }
        public string? Title { get; init; }
        public string? Brand { get; init; }
        public string? SalesUnitSize { get; init; }
        public string? WebPath { get; init; }
        public MemberPriceV2? PriceV2 { get; init; }
        public List<ImagePack>? ImagePack { get; init; }
    }

    private sealed record MemberPriceV2
    {
        public BonusMoney? Now { get; init; }
        public BonusMoney? Was { get; init; }
        public MemberDiscount? Discount { get; init; }
    }

    private sealed record MemberDiscount
    {
        public string? Description { get; init; }
    }

    private sealed record ImagePack
    {
        public ImageRendition? Small { get; init; }
        public ImageRendition? Medium { get; init; }
    }

    private sealed record ImageRendition
    {
        public string? Url { get; init; }
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
