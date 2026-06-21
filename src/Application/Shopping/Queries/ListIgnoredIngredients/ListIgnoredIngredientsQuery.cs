using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Queries.ListIgnoredIngredients;

/// <summary>The household's own "never buy" ingredients (not the built-in ones).</summary>
public record ListIgnoredIngredientsQuery : IRequest<IReadOnlyList<string>>;

public class ListIgnoredIngredientsQueryHandler : IRequestHandler<ListIgnoredIngredientsQuery, IReadOnlyList<string>>
{
    private readonly IApplicationDbContext _context;

    public ListIgnoredIngredientsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<string>> Handle(ListIgnoredIngredientsQuery request, CancellationToken cancellationToken)
    {
        return await _context.IgnoredIngredients
            .AsNoTracking()
            .OrderBy(i => i.NormalizedName)
            .Select(i => i.NormalizedName)
            .ToListAsync(cancellationToken);
    }
}
