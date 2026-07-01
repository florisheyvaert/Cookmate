using Cookmate.Application.Common;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Promotions.Common;
using Cookmate.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Queries.GetCartDishes;

/// <summary>
/// "What can I make?" — ranks dishes from the suggestion pool by how many of their non-staple
/// ingredients are already in the cart. Most-covered first; ties broken by fewest ingredients
/// still to buy. Reuses the promo token matcher so "eieren" in the cart matches a dish that
/// needs eggs, a linked "AH scharrel eieren 10st" product matches it too, etc.
/// </summary>
public record GetCartDishesQuery : IRequest<IReadOnlyList<CartDishDto>>
{
    public int Limit { get; init; } = 50;
}

public class GetCartDishesQueryHandler : IRequestHandler<GetCartDishesQuery, IReadOnlyList<CartDishDto>>
{
    private readonly IApplicationDbContext _context;

    public GetCartDishesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CartDishDto>> Handle(GetCartDishesQuery request, CancellationToken cancellationToken)
    {
        var items = await _context.ShoppingCartItems.AsNoTracking()
            .Select(i => i.DisplayName)
            .ToListAsync(cancellationToken);
        if (items.Count == 0) return [];

        // Each cart line reduced to its food stems once.
        var cartStems = items
            .Select(PromoIngredientMatcher.FoodStems)
            .Where(s => s.Count > 0)
            .ToList();
        if (cartStems.Count == 0) return [];

        var suggestions = await _context.MealSuggestions.AsNoTracking().ToListAsync(cancellationToken);
        var favicons = await SourceFaviconLookup.LoadAsync(_context, cancellationToken);

        var dishes = new List<CartDishDto>();
        foreach (var s in suggestions)
        {
            var relevant = s.Ingredients
                .Select(i => new { i.Name, Normalized = IngredientNameNormalizer.Normalize(i.Name) })
                .Where(i => !string.IsNullOrWhiteSpace(i.Normalized) && !StapleIngredients.IsStaple(i.Normalized))
                .ToList();
            if (relevant.Count == 0) continue;

            var matched = new List<string>();
            var missing = new List<string>();
            foreach (var ing in relevant)
            {
                if (cartStems.Any(stems => PromoIngredientMatcher.Matches(stems, ing.Name)))
                    matched.Add(ing.Name);
                else
                    missing.Add(ing.Name);
            }

            if (matched.Count == 0) continue;

            dishes.Add(new CartDishDto
            {
                SuggestionId = s.Id,
                Title = s.Title,
                Summary = s.Summary,
                SourceUrl = s.SourceUrl,
                SourceFaviconUrl = favicons.ForSourceId(s.SourceId),
                BaseServings = s.BaseServings,
                TotalTimeMinutes = s.TotalTimeMinutes,
                Tags = s.Tags.ToList(),
                ImageUrl = s.ImageStorageKey != null ? $"/api/MealSuggestions/{s.Id}/image" : null,
                MatchedIngredientCount = matched.Count,
                RelevantIngredientCount = relevant.Count,
                MatchedIngredients = matched,
                MissingIngredients = missing,
            });
        }

        return dishes
            .OrderByDescending(d => d.MatchedIngredientCount)
            .ThenBy(d => d.MissingIngredients.Count)
            .ThenBy(d => d.Title)
            .Take(Math.Clamp(request.Limit, 1, 100))
            .ToList();
    }
}

public record CartDishDto
{
    public int SuggestionId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Summary { get; init; }
    public string SourceUrl { get; init; } = string.Empty;

    /// <summary>Relative URL of the source site's locally-stored favicon, or null.</summary>
    public string? SourceFaviconUrl { get; init; }

    public int BaseServings { get; init; }
    public int? TotalTimeMinutes { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string? ImageUrl { get; init; }

    /// <summary>How many of the dish's non-staple ingredients are already in the cart.</summary>
    public int MatchedIngredientCount { get; init; }

    /// <summary>Total non-staple ingredients (the denominator).</summary>
    public int RelevantIngredientCount { get; init; }

    public IReadOnlyList<string> MatchedIngredients { get; init; } = [];

    /// <summary>Still-needed ingredients — what you'd buy extra to make this.</summary>
    public IReadOnlyList<string> MissingIngredients { get; init; } = [];
}
