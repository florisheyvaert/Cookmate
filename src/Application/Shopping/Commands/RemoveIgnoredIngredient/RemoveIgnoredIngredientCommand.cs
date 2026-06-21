using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Commands.RemoveIgnoredIngredient;

/// <summary>Removes an ingredient from the household "never buy" list.</summary>
public record RemoveIgnoredIngredientCommand : IRequest
{
    public string IngredientName { get; init; } = string.Empty;
}

public class RemoveIgnoredIngredientCommandHandler : IRequestHandler<RemoveIgnoredIngredientCommand>
{
    private readonly IApplicationDbContext _context;

    public RemoveIgnoredIngredientCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(RemoveIgnoredIngredientCommand request, CancellationToken cancellationToken)
    {
        var normalized = IngredientNameNormalizer.Normalize(request.IngredientName);

        var ignored = await _context.IgnoredIngredients
            .FirstOrDefaultAsync(i => i.NormalizedName == normalized, cancellationToken);
        if (ignored is null) return;

        _context.IgnoredIngredients.Remove(ignored);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
