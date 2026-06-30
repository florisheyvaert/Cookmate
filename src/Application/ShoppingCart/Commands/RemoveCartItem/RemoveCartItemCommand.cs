using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.ShoppingCart.Commands.RemoveCartItem;

/// <summary>Removes a single line from the cart.</summary>
public record RemoveCartItemCommand(int Id) : IRequest;

public class RemoveCartItemCommandHandler : IRequestHandler<RemoveCartItemCommand>
{
    private readonly IApplicationDbContext _context;

    public RemoveCartItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(RemoveCartItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.ShoppingCartItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, item);

        _context.ShoppingCartItems.Remove(item);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
