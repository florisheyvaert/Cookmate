using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;
using FluentValidation.Results;

namespace Cookmate.Application.Shopping.Commands.LinkIngredientToProductByUrl;

public record LinkIngredientToProductByUrlCommand : IRequest
{
    public int IngredientId { get; init; }
    public string StoreCode { get; init; } = string.Empty;
    public string ProductUrl { get; init; } = string.Empty;
    public decimal DefaultPackQuantity { get; init; } = 1;
}

public class LinkIngredientToProductByUrlCommandHandler : IRequestHandler<LinkIngredientToProductByUrlCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _registry;

    public LinkIngredientToProductByUrlCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry registry)
    {
        _context = context;
        _registry = registry;
    }

    public async Task Handle(LinkIngredientToProductByUrlCommand request, CancellationToken cancellationToken)
    {
        var store = _registry.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        if (!store.TryParseProductUrl(request.ProductUrl ?? string.Empty, out var sku))
        {
            throw new ValidationException(new[]
            {
                new ValidationFailure(nameof(request.ProductUrl),
                    $"That doesn't look like a {store.DisplayName} product URL."),
            });
        }

        await ProductLinker.AddLinkAsync(
            _context,
            store,
            request.IngredientId,
            sku,
            request.DefaultPackQuantity,
            cancellationToken);
    }
}
