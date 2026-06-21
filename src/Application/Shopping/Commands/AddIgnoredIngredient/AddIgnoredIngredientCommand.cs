using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Common;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Commands.AddIgnoredIngredient;

/// <summary>Adds an ingredient to the household "never buy" list so the cart drops it.</summary>
public record AddIgnoredIngredientCommand : IRequest
{
    public string IngredientName { get; init; } = string.Empty;
}

public class AddIgnoredIngredientCommandHandler : IRequestHandler<AddIgnoredIngredientCommand>
{
    private readonly IApplicationDbContext _context;

    public AddIgnoredIngredientCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(AddIgnoredIngredientCommand request, CancellationToken cancellationToken)
    {
        var normalized = IngredientNameNormalizer.Normalize(request.IngredientName);
        if (string.IsNullOrEmpty(normalized)) return;

        var exists = await _context.IgnoredIngredients
            .AnyAsync(i => i.NormalizedName == normalized, cancellationToken);
        if (exists) return;

        _context.IgnoredIngredients.Add(new IgnoredIngredient(normalized));
        await _context.SaveChangesAsync(cancellationToken);
    }
}
