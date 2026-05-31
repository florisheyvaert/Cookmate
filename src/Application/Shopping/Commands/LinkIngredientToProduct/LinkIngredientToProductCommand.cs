using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Commands.LinkIngredientToProduct;

public record LinkIngredientToProductCommand : IRequest
{
    public int IngredientId { get; init; }
    public string StoreCode { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public decimal DefaultPackQuantity { get; init; } = 1;
}

public class LinkIngredientToProductCommandHandler : IRequestHandler<LinkIngredientToProductCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _registry;

    public LinkIngredientToProductCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry registry)
    {
        _context = context;
        _registry = registry;
    }

    public async Task Handle(LinkIngredientToProductCommand request, CancellationToken cancellationToken)
    {
        var store = _registry.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        await ProductLinker.AddLinkAsync(
            _context,
            store,
            request.IngredientId,
            request.Sku,
            request.DefaultPackQuantity,
            cancellationToken);
    }
}
