using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Commands.ClearIngredientProductPreference;

/// <summary>Forgets the remembered product for an ingredient name at a store.</summary>
public record ClearIngredientProductPreferenceCommand : IRequest
{
    public string StoreCode { get; init; } = string.Empty;

    public string IngredientName { get; init; } = string.Empty;
}

public class ClearIngredientProductPreferenceCommandHandler : IRequestHandler<ClearIngredientProductPreferenceCommand>
{
    private readonly IApplicationDbContext _context;

    public ClearIngredientProductPreferenceCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(ClearIngredientProductPreferenceCommand request, CancellationToken cancellationToken)
    {
        var normalized = IngredientNameNormalizer.Normalize(request.IngredientName);
        var storeCode = request.StoreCode.Trim().ToLowerInvariant();

        var preference = await _context.IngredientProductPreferences
            .FirstOrDefaultAsync(p => p.NormalizedName == normalized && p.StoreCode == storeCode, cancellationToken);

        if (preference is null) return;

        _context.IngredientProductPreferences.Remove(preference);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
