using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Commands.UpdateStorePromotionSetting;

/// <summary>
/// Switches a store's promotions capability on or off (the toggle on the Integrations
/// screen). Creates the per-store row on first use. Only stores that actually have a
/// registered promotion source can be toggled.
/// </summary>
public record UpdateStorePromotionSettingCommand : IRequest
{
    public string StoreCode { get; init; } = string.Empty;

    public bool Enabled { get; init; }
}

public class UpdateStorePromotionSettingCommandHandler : IRequestHandler<UpdateStorePromotionSettingCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<IStorePromotionSource> _sources;

    public UpdateStorePromotionSettingCommandHandler(
        IApplicationDbContext context,
        IEnumerable<IStorePromotionSource> sources)
    {
        _context = context;
        _sources = sources;
    }

    public async Task Handle(UpdateStorePromotionSettingCommand request, CancellationToken cancellationToken)
    {
        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();
        var source = _sources.FirstOrDefault(s => string.Equals(s.Code, code, StringComparison.OrdinalIgnoreCase));
        Guard.Against.NotFound(code, source);

        var setting = await _context.StorePromotionSettings
            .FirstOrDefaultAsync(s => s.StoreCode == code, cancellationToken);
        if (setting is null)
        {
            setting = new StorePromotionSetting(code, request.Enabled);
            _context.StorePromotionSettings.Add(setting);
        }
        else
        {
            setting.SetEnabled(request.Enabled);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
