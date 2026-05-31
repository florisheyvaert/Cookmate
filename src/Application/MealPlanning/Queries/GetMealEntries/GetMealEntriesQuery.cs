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
        // Left-join the recipe so a linked entry can show its current title;
        // free-text entries keep RecipeTitle null.
        var query =
            from e in _context.MealEntries.AsNoTracking()
            where e.Date >= request.From && e.Date <= request.To
            join r in _context.Recipes on e.RecipeId equals r.Id into recipeJoin
            from r in recipeJoin.DefaultIfEmpty()
            orderby e.Date, e.Slot
            select new MealEntryDto
            {
                Id = e.Id,
                Date = e.Date,
                Slot = e.Slot,
                RecipeId = e.RecipeId,
                RecipeTitle = r != null ? r.Title : null,
                FreeText = e.FreeText,
                Servings = e.Servings,
                Notes = e.Notes,
            };

        return await query.ToListAsync(cancellationToken);
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
}
