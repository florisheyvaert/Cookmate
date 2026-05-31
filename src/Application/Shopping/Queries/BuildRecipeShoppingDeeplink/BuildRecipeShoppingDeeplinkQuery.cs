using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;
using Cookmate.Domain.Common;

namespace Cookmate.Application.Shopping.Queries.BuildRecipeShoppingDeeplink;

public record BuildRecipeShoppingDeeplinkQuery : IRequest<ShoppingDeeplinkResultDto>
{
    public int RecipeId { get; init; }
    public int? Servings { get; init; }
    public string StoreCode { get; init; } = string.Empty;
}

public class BuildRecipeShoppingDeeplinkQueryHandler
    : IRequestHandler<BuildRecipeShoppingDeeplinkQuery, ShoppingDeeplinkResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _registry;

    public BuildRecipeShoppingDeeplinkQueryHandler(IApplicationDbContext context, IGroceryStoreRegistry registry)
    {
        _context = context;
        _registry = registry;
    }

    public async Task<ShoppingDeeplinkResultDto> Handle(
        BuildRecipeShoppingDeeplinkQuery request, CancellationToken cancellationToken)
    {
        var store = _registry.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var recipe = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == request.RecipeId, cancellationToken);
        Guard.Against.NotFound(request.RecipeId, recipe);

        var servings = request.Servings ?? recipe.BaseServings;
        var factor = recipe.ScaleFactorFor(servings);

        return await ShoppingProjection.BuildAsync(
            _context,
            store,
            new[] { (recipe, factor) },
            cancellationToken);
    }
}
