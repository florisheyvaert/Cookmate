using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.Recipes.Queries.ListRecipes;

public record ListRecipesQuery : IRequest<IReadOnlyList<RecipeSummaryDto>>
{
    public string? Search { get; init; }

    public string? Tag { get; init; }

    /// <summary>Substring match against the recipe's source URL (host + path), case-insensitive.</summary>
    public string? Source { get; init; }

    /// <summary>Inclusive cap on TotalTimeMinutes. Recipes without a time are always included.</summary>
    public int? MaxTimeMinutes { get; init; }
}

public class ListRecipesQueryHandler : IRequestHandler<ListRecipesQuery, IReadOnlyList<RecipeSummaryDto>>
{
    private readonly IApplicationDbContext _context;

    public ListRecipesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<RecipeSummaryDto>> Handle(ListRecipesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Recipes.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var needle = request.Search.Trim().ToLower();
            query = query.Where(r =>
                r.Title.ToLower().Contains(needle) ||
                (r.Summary != null && r.Summary.ToLower().Contains(needle)));
        }

        if (!string.IsNullOrWhiteSpace(request.Tag))
        {
            var tag = request.Tag.Trim().ToLower();
            query = query.Where(r => r.Tags.Contains(tag));
        }

        if (!string.IsNullOrWhiteSpace(request.Source))
        {
            var source = request.Source.Trim().ToLower();
            query = query.Where(r => r.SourceUrl != null && r.SourceUrl.ToLower().Contains(source));
        }

        if (request.MaxTimeMinutes is int max && max > 0)
        {
            query = query.Where(r => r.TotalTimeMinutes == null || r.TotalTimeMinutes <= max);
        }

        return await query
            .OrderBy(r => r.Title)
            .Select(r => new RecipeSummaryDto
            {
                Id = r.Id,
                Title = r.Title,
                Summary = r.Summary,
                SourceUrl = r.SourceUrl,
                BaseServings = r.BaseServings,
                TotalTimeMinutes = r.TotalTimeMinutes,
                Tags = r.Tags.ToList()
            })
            .ToListAsync(cancellationToken);
    }
}

public record RecipeSummaryDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public string? SourceUrl { get; init; }

    public int BaseServings { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = [];
}
