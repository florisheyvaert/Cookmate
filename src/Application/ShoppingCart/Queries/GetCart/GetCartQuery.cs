using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Queries.GetCart;

/// <summary>The whole shopping cart, newest lines first.</summary>
public record GetCartQuery : IRequest<CartDto>;

public class GetCartQueryHandler : IRequestHandler<GetCartQuery, CartDto>
{
    private readonly IApplicationDbContext _context;

    public GetCartQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CartDto> Handle(GetCartQuery request, CancellationToken cancellationToken)
    {
        var items = await _context.ShoppingCartItems.AsNoTracking()
            .OrderByDescending(i => i.Created)
            .Select(i => new CartLineDto
            {
                Id = i.Id,
                DisplayName = i.DisplayName,
                StoreCode = i.StoreCode,
                Sku = i.Sku,
                ImageUrl = i.ImageUrl,
                Quantity = i.Quantity,
                Source = i.Source,
                IsLinked = i.StoreCode != null && i.Sku != null,
            })
            .ToListAsync(cancellationToken);

        return new CartDto
        {
            Items = items,
            LinkedCount = items.Count(i => i.IsLinked),
        };
    }
}

public record CartDto
{
    public IReadOnlyList<CartLineDto> Items { get; init; } = [];

    /// <summary>How many lines point at a real store product (and so can be deep-linked).</summary>
    public int LinkedCount { get; init; }
}

public record CartLineDto
{
    public int Id { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string? StoreCode { get; init; }
    public string? Sku { get; init; }
    public string? ImageUrl { get; init; }
    public int Quantity { get; init; }
    public CartItemSource Source { get; init; }
    public bool IsLinked { get; init; }
}
