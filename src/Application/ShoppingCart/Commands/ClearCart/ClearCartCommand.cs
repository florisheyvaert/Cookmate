using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.ClearCart;

/// <summary>Empties the shopping cart.</summary>
public record ClearCartCommand : IRequest;

public class ClearCartCommandHandler : IRequestHandler<ClearCartCommand>
{
    private readonly IApplicationDbContext _context;

    public ClearCartCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(ClearCartCommand request, CancellationToken cancellationToken)
    {
        var items = await _context.ShoppingCartItems.ToListAsync(cancellationToken);
        if (items.Count == 0) return;

        _context.ShoppingCartItems.RemoveRange(items);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
