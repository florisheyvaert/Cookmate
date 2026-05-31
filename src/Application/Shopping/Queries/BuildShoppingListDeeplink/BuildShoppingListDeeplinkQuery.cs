using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Queries.BuildShoppingListDeeplink;

public record BuildShoppingListDeeplinkQuery : IRequest<ShoppingDeeplinkResultDto>
{
    public string StoreCode { get; init; } = string.Empty;
    public IReadOnlyList<RecipeSelection> Selections { get; init; } = [];
}

public record RecipeSelection
{
    public int RecipeId { get; init; }
    public int? Servings { get; init; }
}

public class BuildShoppingListDeeplinkQueryHandler
    : IRequestHandler<BuildShoppingListDeeplinkQuery, ShoppingDeeplinkResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _registry;

    public BuildShoppingListDeeplinkQueryHandler(IApplicationDbContext context, IGroceryStoreRegistry registry)
    {
        _context = context;
        _registry = registry;
    }

    public async Task<ShoppingDeeplinkResultDto> Handle(
        BuildShoppingListDeeplinkQuery request, CancellationToken cancellationToken)
    {
        var store = _registry.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        if (request.Selections.Count == 0)
        {
            return new ShoppingDeeplinkResultDto
            {
                StoreCode = store.Code,
                StoreDisplayName = store.DisplayName,
            };
        }

        var ids = request.Selections.Select(s => s.RecipeId).Distinct().ToArray();
        var recipes = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.Ingredients)
            .Where(r => ids.Contains(r.Id))
            .ToListAsync(cancellationToken);

        var pairs = request.Selections
            .Select(sel =>
            {
                var recipe = recipes.FirstOrDefault(r => r.Id == sel.RecipeId);
                if (recipe is null) return ((Domain.Entities.Recipe?)null, 0m);
                var servings = sel.Servings ?? recipe.BaseServings;
                return ((Domain.Entities.Recipe?)recipe, recipe.ScaleFactorFor(servings));
            })
            .Where(p => p.Item1 is not null)
            .Select(p => (p.Item1!, p.Item2))
            .ToList();

        return await ShoppingProjection.BuildAsync(_context, store, pairs, cancellationToken);
    }
}
