using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.Shopping.Commands.UnlinkIngredient;

/// <summary>
/// Removes a single ingredient ↔ product binding by its link id. An
/// ingredient can have many links so we delete by exact row, not by
/// (ingredient, store) which used to be unique.
/// </summary>
public record UnlinkIngredientCommand(int LinkId) : IRequest;

public class UnlinkIngredientCommandHandler : IRequestHandler<UnlinkIngredientCommand>
{
    private readonly IApplicationDbContext _context;

    public UnlinkIngredientCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UnlinkIngredientCommand request, CancellationToken cancellationToken)
    {
        var link = await _context.RecipeIngredientProductLinks
            .FirstOrDefaultAsync(l => l.Id == request.LinkId, cancellationToken);

        if (link is null) return;

        _context.RecipeIngredientProductLinks.Remove(link);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
