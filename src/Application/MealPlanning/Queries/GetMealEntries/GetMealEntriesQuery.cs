using Cookmate.Application.Common;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.MealPlanning.Queries.GetMealEntries;

public record GetMealEntriesQuery : IRequest<IReadOnlyList<MealEntryDto>>
{
    public DateOnly From { get; init; }

    public DateOnly To { get; init; }
}

public class GetMealEntriesQueryHandler : IRequestHandler<GetMealEntriesQuery, IReadOnlyList<MealEntryDto>>
{
    private readonly IApplicationDbContext _context;

    public GetMealEntriesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<MealEntryDto>> Handle(GetMealEntriesQuery request, CancellationToken cancellationToken)
    {
        // Left-join the recipe (for its title + cover photo) and the suggestion (for its
        // photo, when the entry was planned from Ideas). Two-step so the image URL is
        // built in memory (same approach as ListRecipes).
        var rows = await (
            from e in _context.MealEntries.AsNoTracking()
            where e.Date >= request.From && e.Date <= request.To
            join r in _context.Recipes on e.RecipeId equals r.Id into recipeJoin
            from r in recipeJoin.DefaultIfEmpty()
            join s in _context.MealSuggestions on e.MealSuggestionId equals s.Id into suggestionJoin
            from s in suggestionJoin.DefaultIfEmpty()
            orderby e.Date, e.Slot
            select new
            {
                e.Id,
                e.Date,
                e.Slot,
                e.RecipeId,
                RecipeTitle = r != null ? r.Title : null,
                e.FreeText,
                e.Servings,
                e.Notes,
                CoverMediaId = r != null
                    ? r.Media.Where(m => m.Type == MediaType.Photo).OrderBy(m => m.Order).Select(m => (int?)m.Id).FirstOrDefault()
                    : null,
                RecipeSourceUrl = r != null ? r.SourceUrl : null,
                SuggestionId = e.MealSuggestionId,
                SuggestionHasImage = s != null && s.ImageStorageKey != null,
                SuggestionSourceId = s != null ? (int?)s.SourceId : null,
            }).ToListAsync(cancellationToken);

        var favicons = await SourceFaviconLookup.LoadAsync(_context, cancellationToken);

        return rows
            .Select(x => new MealEntryDto
            {
                Id = x.Id,
                Date = x.Date,
                Slot = x.Slot,
                RecipeId = x.RecipeId,
                RecipeTitle = x.RecipeTitle,
                FreeText = x.FreeText,
                Servings = x.Servings,
                Notes = x.Notes,
                ImageUrl = x.RecipeId is int rid && x.CoverMediaId is int mid
                    ? $"/api/Recipes/{rid}/media/{mid}/file"
                    : x.SuggestionId is int sid && x.SuggestionHasImage
                        ? $"/api/MealSuggestions/{sid}/image"
                        : null,
                // A planned meal is either a recipe (match favicon on its source host) or a
                // harvested suggestion (match on its owning source id).
                SourceFaviconUrl = x.RecipeId != null
                    ? favicons.ForUrl(x.RecipeSourceUrl)
                    : x.SuggestionSourceId is int ssid
                        ? favicons.ForSourceId(ssid)
                        : null,
            })
            .ToList();
    }
}

public record MealEntryDto
{
    public int Id { get; init; }

    public DateOnly Date { get; init; }

    public MealSlot Slot { get; init; }

    public int? RecipeId { get; init; }

    public string? RecipeTitle { get; init; }

    public string? FreeText { get; init; }

    public int? Servings { get; init; }

    public string? Notes { get; init; }

    /// <summary>Dish photo (relative API URL) from the linked recipe or suggestion, or null when none.</summary>
    public string? ImageUrl { get; init; }

    /// <summary>Relative URL of the source site's locally-stored favicon, or null.</summary>
    public string? SourceFaviconUrl { get; init; }
}
