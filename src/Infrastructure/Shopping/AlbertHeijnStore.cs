using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Shopping;

/// <summary>
/// Albert Heijn integration. Two halves:
///  • <see cref="BuildAddToListDeeplink"/> — pure URL builder against the
///    sanctioned partner-program "add to list" endpoint that's been stable
///    since 2016.
///  • <see cref="SearchAsync"/> — best-effort hit on AH's mobile product
///    search API, authenticated with an anonymous bearer token. The web
///    `/zoeken/api/...` endpoint returns 403 without a browser session, so
///    we go through the mobile path used by the AH app — same data, no
///    cookie shenanigans. Wraps every failure mode (network, auth, parse)
///    in a warning log + empty list, so the UI degrades to the paste-URL
///    fallback if AH ever closes this off.
/// </summary>
public class AlbertHeijnStore : IGroceryStore, IStorePromotionSource
{
    public const string StoreCode = "ah";

    private const int MaxItemsPerDeeplink = 50;
    private const string SearchEndpoint = "/mobile-services/product/search/v2";
    private const string ProductDetailEndpoint = "/mobile-services/product/detail/v4/fir/";

    // The weekly "bonus" promotions are the regular product search filtered to
    // bonus-only. AH caps total search results, so we page through a bounded number
    // of pages — plenty for the few hundred products that are ever on bonus.
    private const int PromoPageSize = 100;
    private const int MaxPromoPages = 6;

    private static readonly Regex ProductUrlRegex = new(
        @"^https?://(?:www\.)?ah\.nl/producten/product/wi(?<sku>\d+)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly IHttpClientFactory _factory;
    private readonly AlbertHeijnTokenSource _tokens;
    private readonly ILogger<AlbertHeijnStore> _logger;

    public AlbertHeijnStore(
        IHttpClientFactory factory,
        AlbertHeijnTokenSource tokens,
        ILogger<AlbertHeijnStore> logger)
    {
        _factory = factory;
        _tokens = tokens;
        _logger = logger;
    }

    public string Code => StoreCode;
    public string DisplayName => "Albert Heijn";

    public async Task<IReadOnlyList<GroceryProductCandidate>> SearchAsync(
        string query, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query)) return Array.Empty<GroceryProductCandidate>();

        var token = await _tokens.GetAsync(cancellationToken);
        if (token is null) return Array.Empty<GroceryProductCandidate>();

        var path = $"{SearchEndpoint}?query={Uri.EscapeDataString(query.Trim())}&size=10&sortOn=RELEVANCE";

        try
        {
            var response = await SendAsync(path, token, cancellationToken);

            // Token can outlive its real validity if AH rotates early. One
            // forced refresh + retry covers that without looping forever.
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                response.Dispose();
                var fresh = await _tokens.RefreshAsync(cancellationToken);
                if (fresh is null) return Array.Empty<GroceryProductCandidate>();
                response = await SendAsync(path, fresh, cancellationToken);
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogInformation(
                        "AH search returned {Status} for query '{Query}'",
                        (int)response.StatusCode, query);
                    return Array.Empty<GroceryProductCandidate>();
                }

                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                var payload = await JsonSerializer.DeserializeAsync<SearchResponse>(
                    stream, JsonOptions, cancellationToken);

                return ExtractCandidates(payload);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH search failed for query '{Query}'", query);
            return Array.Empty<GroceryProductCandidate>();
        }
    }

    public async Task<GroceryProductCandidate?> FindBySkuAsync(string sku, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sku)) return null;

        var token = await _tokens.GetAsync(cancellationToken);
        if (token is null) return null;

        var path = $"{ProductDetailEndpoint}{Uri.EscapeDataString(sku.Trim())}";

        try
        {
            var response = await SendAsync(path, token, cancellationToken);

            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                response.Dispose();
                var fresh = await _tokens.RefreshAsync(cancellationToken);
                if (fresh is null) return null;
                response = await SendAsync(path, fresh, cancellationToken);
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogInformation(
                        "AH product detail returned {Status} for SKU '{Sku}'",
                        (int)response.StatusCode, sku);
                    return null;
                }

                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                var payload = await JsonSerializer.DeserializeAsync<ProductDetailResponse>(
                    stream, JsonOptions, cancellationToken);

                return ToCandidate(payload?.ProductCard ?? payload?.Product);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH product detail fetch failed for SKU '{Sku}'", sku);
            return null;
        }
    }

    public async Task<IReadOnlyList<StorePromotion>> GetPromotionsAsync(CancellationToken cancellationToken)
    {
        var token = await _tokens.GetAsync(cancellationToken);
        if (token is null) return Array.Empty<StorePromotion>();

        var promotions = new List<StorePromotion>();
        var seen = new HashSet<string>();

        try
        {
            for (var page = 0; page < MaxPromoPages; page++)
            {
                // Empty query + the bonus filter returns the current bonus assortment.
                var path = $"{SearchEndpoint}?query=&filters=bonus%3Dtrue&size={PromoPageSize}&page={page}";

                var response = await SendAsync(path, token, cancellationToken);
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    response.Dispose();
                    var fresh = await _tokens.RefreshAsync(cancellationToken);
                    if (fresh is null) break;
                    token = fresh;
                    response = await SendAsync(path, token, cancellationToken);
                }

                using (response)
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "AH bonus search returned {Status} on page {Page}",
                            (int)response.StatusCode, page);
                        break;
                    }

                    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                    var payload = await JsonSerializer.DeserializeAsync<SearchResponse>(
                        stream, JsonOptions, cancellationToken);

                    var products = payload?.Products;
                    if (products is null || products.Count == 0) break;

                    foreach (var product in products)
                    {
                        var promo = ToPromotion(product);
                        // Dedupe across pages and skip non-bonus rows defensively.
                        if (promo is not null && seen.Add(promo.Sku)) promotions.Add(promo);
                    }

                    // Last (partial) page reached.
                    if (products.Count < PromoPageSize) break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH bonus fetch failed");
            // Return whatever we gathered before the failure rather than nothing.
        }

        return promotions;
    }

    public GroceryDeeplink BuildAddToListDeeplink(IReadOnlyList<DeeplinkLineItem> items)
    {
        ArgumentNullException.ThrowIfNull(items);
        if (items.Count == 0) throw new ArgumentException("At least one item is required.", nameof(items));

        var truncated = items.Count > MaxItemsPerDeeplink;
        var taken = truncated ? items.Take(MaxItemsPerDeeplink) : items;

        // AH's add-multiple takes ONE repeated `p` query parameter per product —
        // "?p=<id>:<qty>&p=<id>:<qty>" — NOT a single comma-joined `p`. With commas
        // AH only reads the first pair and drops the rest. The ':' stays literal; the
        // SKU is escaped (numeric webshop ids are a no-op).
        var query = string.Join('&', taken.Select(i =>
        {
            if (string.IsNullOrWhiteSpace(i.Sku)) throw new ArgumentException("SKU is required.", nameof(items));
            if (i.Quantity < 1) throw new ArgumentException("Quantity must be at least 1.", nameof(items));
            return $"p={Uri.EscapeDataString(i.Sku)}:{i.Quantity}";
        }));

        var url = new Uri($"https://www.ah.be/mijnlijst/add-multiple?{query}");
        return new GroceryDeeplink(url, truncated);
    }

    public bool TryParseProductUrl(string url, out string sku)
    {
        sku = string.Empty;
        if (string.IsNullOrWhiteSpace(url)) return false;

        var match = ProductUrlRegex.Match(url.Trim());
        if (!match.Success) return false;

        sku = match.Groups["sku"].Value;
        return true;
    }

    private async Task<HttpResponseMessage> SendAsync(string path, string token, CancellationToken ct)
    {
        var http = _factory.CreateClient(AlbertHeijnTokenSource.ClientName);
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    // ─── Search response shape ─────────────────────────────────────────────
    // Mobile API returns a flat `products[]` (no `cards` wrapper like the
    // web search). Schema is best-effort; missing fields default sensibly
    // and the parser never throws on shape drift.

    private static IReadOnlyList<GroceryProductCandidate> ExtractCandidates(SearchResponse? payload)
    {
        if (payload?.Products is null) return Array.Empty<GroceryProductCandidate>();

        var list = new List<GroceryProductCandidate>(payload.Products.Count);
        foreach (var product in payload.Products)
        {
            var candidate = ToCandidate(product);
            if (candidate is not null) list.Add(candidate);
        }

        return list;
    }

    private static GroceryProductCandidate? ToCandidate(Product? product)
    {
        if (product is null) return null;
        if (product.WebshopId is null or 0) return null;
        if (string.IsNullOrWhiteSpace(product.Title)) return null;

        var packSize = ParseSalesUnitSize(product.SalesUnitSize);
        var image = product.Images?.FirstOrDefault()?.Url;
        var canonical = $"https://www.ah.be/producten/product/wi{product.WebshopId.Value}";

        return new GroceryProductCandidate(
            Sku: product.WebshopId.Value.ToString(),
            Name: product.Title.Trim(),
            BrandOrSubtitle: !string.IsNullOrWhiteSpace(product.Brand)
                ? product.Brand.Trim()
                : product.Subtitle?.Trim(),
            PackSize: packSize,
            UnitPrice: product.PriceV2?.Now?.Amount,
            Currency: "EUR",
            ImageUrl: image,
            CanonicalUrl: canonical);
    }

    private static StorePromotion? ToPromotion(Product? product)
    {
        if (product is null) return null;
        if (product.WebshopId is null or 0) return null;
        if (string.IsNullOrWhiteSpace(product.Title)) return null;

        var image = product.Images?.FirstOrDefault()?.Url;
        var canonical = $"https://www.ah.nl/producten/product/wi{product.WebshopId.Value}";

        return new StorePromotion(
            Sku: product.WebshopId.Value.ToString(),
            Name: product.Title.Trim(),
            BrandOrSubtitle: !string.IsNullOrWhiteSpace(product.Brand)
                ? product.Brand.Trim()
                : product.Subtitle?.Trim(),
            PackSize: ParseSalesUnitSize(product.SalesUnitSize),
            // Null for multi-buy mechanisms ("2 voor 0.99"); DiscountLabel carries those.
            OriginalPrice: product.PriceBeforeBonus,
            PromoPrice: product.CurrentPrice,
            DiscountLabel: string.IsNullOrWhiteSpace(product.BonusMechanism)
                ? null
                : product.BonusMechanism.Trim(),
            Currency: "EUR",
            ImageUrl: image,
            CanonicalUrl: canonical,
            ValidFrom: ParseIsoDate(product.BonusStartDate),
            ValidTo: ParseIsoDate(product.BonusEndDate));
    }

    private static DateOnly? ParseIsoDate(string? raw) =>
        DateOnly.TryParseExact(
            raw,
            "yyyy-MM-dd",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out var date)
            ? date
            : null;

    private static readonly Regex SalesUnitRegex = new(
        @"^\s*(?<amount>[\d.,]+)\s*(?<unit>[a-zA-Z]+)?\s*$",
        RegexOptions.Compiled);

    private static Quantity ParseSalesUnitSize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new Quantity(0, "stuks");

        var match = SalesUnitRegex.Match(raw);
        if (!match.Success) return new Quantity(0, raw.Trim());

        var amountText = match.Groups["amount"].Value.Replace(',', '.');
        if (!decimal.TryParse(
                amountText,
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture,
                out var amount))
        {
            return new Quantity(0, raw.Trim());
        }

        var unit = match.Groups["unit"].Success ? match.Groups["unit"].Value.Trim() : "stuks";
        return new Quantity(amount, unit);
    }

    private record SearchResponse
    {
        public List<Product>? Products { get; init; }
    }

    /// <summary>
    /// AH's product detail endpoint nests the actual product under either
    /// <c>productCard</c> or <c>product</c> depending on the variant — we
    /// accept both and let the parser pick whichever is present.
    /// </summary>
    private record ProductDetailResponse
    {
        public Product? ProductCard { get; init; }
        public Product? Product { get; init; }
    }

    private record Product
    {
        public long? WebshopId { get; init; }
        public string? Title { get; init; }
        public string? Subtitle { get; init; }
        public string? Brand { get; init; }
        public string? SalesUnitSize { get; init; }
        public PriceV2? PriceV2 { get; init; }
        public List<Image>? Images { get; init; }

        // Bonus/promotion fields — present on bonus-filtered search results.
        public bool? IsBonus { get; init; }
        public decimal? CurrentPrice { get; init; }
        public decimal? PriceBeforeBonus { get; init; }
        public string? BonusMechanism { get; init; }
        public string? BonusStartDate { get; init; }
        public string? BonusEndDate { get; init; }
    }

    private record PriceV2
    {
        public PriceAmount? Now { get; init; }
    }

    private record PriceAmount
    {
        public decimal? Amount { get; init; }
    }

    private record Image
    {
        public string? Url { get; init; }
    }
}
