using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;
using Cookmate.Domain.Common;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Shopping.Commands.SetIngredientProductPreference;

/// <summary>Remembers (or updates) which store product an ingredient name maps to, so the
/// weekly cart auto-links it next time.</summary>
public record SetIngredientProductPreferenceCommand : IRequest
{
    public string StoreCode { get; init; } = string.Empty;

    public string IngredientName { get; init; } = string.Empty;

    public string Sku { get; init; } = string.Empty;

    public decimal DefaultPackQuantity { get; init; } = 1m;
}

public class SetIngredientProductPreferenceCommandHandler : IRequestHandler<SetIngredientProductPreferenceCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _stores;

    public SetIngredientProductPreferenceCommandHandler(IApplicationDbContext context, IGroceryStoreRegistry stores)
    {
        _context = context;
        _stores = stores;
    }

    public async Task Handle(SetIngredientProductPreferenceCommand request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        var normalized = IngredientNameNormalizer.Normalize(request.IngredientName);
        var product = await GroceryProductResolver.EnsureAsync(_context, store, request.Sku, cancellationToken);

        var preference = await _context.IngredientProductPreferences
            .FirstOrDefaultAsync(p => p.NormalizedName == normalized && p.StoreCode == store.Code, cancellationToken);

        if (preference is null)
        {
            preference = new IngredientProductPreference(normalized, product, request.DefaultPackQuantity);
            _context.IngredientProductPreferences.Add(preference);
        }
        else
        {
            preference.PointAt(product, request.DefaultPackQuantity);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
