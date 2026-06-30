using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Promotions.Common;
using Cookmate.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.GetPromoDishes;

/// <summary>
/// Given a store's current promos (optionally narrowed to a selected set of SKUs), finds
/// dishes from the harvested suggestion pool you can make with them — ranked by how many of
/// each dish's (non-staple) ingredients are on promo. A match is "confirmed" when the user
/// has already linked that ingredient name to the promo product (an IngredientProductPreference),
/// otherwise "suggested" via best-effort token matching.
/// </summary>
public record GetPromoDishesQuery : IRequest<IReadOnlyList<PromoDishDto>>
{
    public string StoreCode { get; init; } = string.Empty;

    /// <summary>Selected promo SKUs. Empty = match against all of the store's current promos.</summary>
    public IReadOnlyList<string> Skus { get; init; } = [];

    public int Limit { get; init; } = 24;
}

public class GetPromoDishesQueryHandler : IRequestHandler<GetPromoDishesQuery, IReadOnlyList<PromoDishDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPromoDishesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PromoDishDto>> Handle(GetPromoDishesQuery request, CancellationToken cancellationToken)
    {
        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();

        var promoQuery = _context.Promotions.AsNoTracking().Where(p => p.StoreCode == code);
        if (request.Skus.Count > 0)
        {
            var selected = request.Skus.ToHashSet();
            promoQuery = promoQuery.Where(p => selected.Contains(p.Sku));
        }

        var promos = await promoQuery.ToListAsync(cancellationToken);
        if (promos.Count == 0) return [];

        var skus = promos.Select(p => p.Sku).ToHashSet();
        var products = await _context.GroceryProducts.AsNoTracking()
            .Where(p => p.StoreCode == code && skus.Contains(p.Sku))
            .Select(p => new { p.Id, p.Sku, p.Name })
            .ToListAsync(cancellationToken);

        var nameBySku = products.ToDictionary(p => p.Sku, p => p.Name);
        var skuByProductId = products.ToDictionary(p => p.Id, p => p.Sku);

        // Confirmed links: normalized ingredient name → the promo SKUs it's pinned to.
        var productIds = products.Select(p => p.Id).ToHashSet();
        var prefs = await _context.IngredientProductPreferences.AsNoTracking()
            .Where(pr => pr.StoreCode == code && productIds.Contains(pr.GroceryProductId))
            .Select(pr => new { pr.NormalizedName, pr.GroceryProductId })
            .ToListAsync(cancellationToken);

        var confirmedSkusByName = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var pr in prefs)
        {
            if (!skuByProductId.TryGetValue(pr.GroceryProductId, out var sku)) continue;
            if (!confirmedSkusByName.TryGetValue(pr.NormalizedName, out var set))
                confirmedSkusByName[pr.NormalizedName] = set = new HashSet<string>(StringComparer.Ordinal);
            set.Add(sku);
        }

        // Precompute each promo's food stems once.
        var promoInfos = promos
            .Select(p => new PromoInfo(
                p.Sku,
                nameBySku.TryGetValue(p.Sku, out var n) ? n : p.Sku,
                p.DiscountLabel,
                PromoIngredientMatcher.FoodStems(nameBySku.TryGetValue(p.Sku, out var nm) ? nm : string.Empty)))
            .ToList();

        // Family-scale pool — load and match in memory.
        var suggestions = await _context.MealSuggestions.AsNoTracking().ToListAsync(cancellationToken);

        var dishes = new List<PromoDishDto>();
        foreach (var s in suggestions)
        {
            var relevant = s.Ingredients
                .Select(i => new { i.Name, Normalized = IngredientNameNormalizer.Normalize(i.Name) })
                .Where(i => !string.IsNullOrWhiteSpace(i.Normalized) && !StapleIngredients.IsStaple(i.Normalized))
                .ToList();
            if (relevant.Count == 0) continue;

            var usedConfirmed = new Dictionary<string, bool>(StringComparer.Ordinal); // sku → confirmed?
            var usedIngredient = new Dictionary<string, string>(StringComparer.Ordinal); // sku → ingredient it matched
            var matchedIngredients = 0;

            foreach (var ing in relevant)
            {
                var coveringSkus = new List<(string Sku, bool Confirmed)>();

                if (confirmedSkusByName.TryGetValue(ing.Normalized, out var confirmed))
                    foreach (var sku in confirmed) coveringSkus.Add((sku, true));

                foreach (var promo in promoInfos)
                    if (PromoIngredientMatcher.Matches(promo.Stems, ing.Name))
                        coveringSkus.Add((promo.Sku, false));

                if (coveringSkus.Count == 0) continue;
                matchedIngredients++;

                foreach (var (sku, confirmedFlag) in coveringSkus)
                {
                    usedConfirmed[sku] = usedConfirmed.TryGetValue(sku, out var existing) ? existing || confirmedFlag : confirmedFlag;
                    // Keep the ingredient name so the UI can confirm the (name → sku) link.
                    usedIngredient.TryAdd(sku, ing.Name);
                }
            }

            if (matchedIngredients == 0) continue;

            var usedPromos = usedConfirmed
                .Select(kv => new PromoUsageDto
                {
                    Sku = kv.Key,
                    Name = nameBySku.TryGetValue(kv.Key, out var n) ? n : kv.Key,
                    DiscountLabel = promoInfos.FirstOrDefault(p => p.Sku == kv.Key)?.DiscountLabel,
                    Confirmed = kv.Value,
                    IngredientName = usedIngredient.TryGetValue(kv.Key, out var ingName) ? ingName : string.Empty,
                })
                .OrderByDescending(p => p.Confirmed)
                .ThenBy(p => p.Name)
                .ToList();

            dishes.Add(new PromoDishDto
            {
                SuggestionId = s.Id,
                Title = s.Title,
                Summary = s.Summary,
                SourceUrl = s.SourceUrl,
                BaseServings = s.BaseServings,
                TotalTimeMinutes = s.TotalTimeMinutes,
                Tags = s.Tags.ToList(),
                ImageUrl = s.ImageStorageKey != null ? $"/api/MealSuggestions/{s.Id}/image" : null,
                MatchedIngredientCount = matchedIngredients,
                RelevantIngredientCount = relevant.Count,
                UsedPromos = usedPromos,
            });
        }

        // Most promo-covered first, then best coverage ratio, then title.
        return dishes
            .OrderByDescending(d => d.MatchedIngredientCount)
            .ThenByDescending(d => d.RelevantIngredientCount == 0 ? 0 : (double)d.MatchedIngredientCount / d.RelevantIngredientCount)
            .ThenBy(d => d.Title)
            .Take(Math.Clamp(request.Limit, 1, 100))
            .ToList();
    }

    private sealed record PromoInfo(string Sku, string Name, string? DiscountLabel, IReadOnlyCollection<string> Stems);
}

public record PromoDishDto
{
    public int SuggestionId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Summary { get; init; }
    public string SourceUrl { get; init; } = string.Empty;
    public int BaseServings { get; init; }
    public int? TotalTimeMinutes { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string? ImageUrl { get; init; }

    /// <summary>How many of the dish's non-staple ingredients are covered by a selected promo.</summary>
    public int MatchedIngredientCount { get; init; }

    /// <summary>Total non-staple ingredients (the denominator for "promo coverage").</summary>
    public int RelevantIngredientCount { get; init; }

    public IReadOnlyList<PromoUsageDto> UsedPromos { get; init; } = [];
}

public record PromoUsageDto
{
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? DiscountLabel { get; init; }

    /// <summary>True when this came from a remembered link, false when best-effort matched.</summary>
    public bool Confirmed { get; init; }

    /// <summary>The dish ingredient this promo matched — used to confirm the (name → SKU) link.</summary>
    public string IngredientName { get; init; } = string.Empty;
}
