using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.SetCartItemQuantity;

/// <summary>Sets a cart line's quantity. A quantity of 0 or less removes the line.</summary>
public record SetCartItemQuantityCommand : IRequest
{
    public int Id { get; init; }

    public int Quantity { get; init; }
}

public class SetCartItemQuantityCommandHandler : IRequestHandler<SetCartItemQuantityCommand>
{
    private readonly IApplicationDbContext _context;

    public SetCartItemQuantityCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(SetCartItemQuantityCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.ShoppingCartItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, item);

        if (request.Quantity < 1)
        {
            _context.ShoppingCartItems.Remove(item);
        }
        else
        {
            item.SetQuantity(request.Quantity);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
