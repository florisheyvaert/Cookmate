using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Commands.UpdateSuggestionSource;

/// <summary>Edits a source: rename, change host, enable/disable, and set listing URLs / cap.</summary>
public record UpdateSuggestionSourceCommand : IRequest
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Host { get; init; } = string.Empty;

    public bool Enabled { get; init; } = true;

    public IReadOnlyList<string> ListingUrls { get; init; } = [];

    public int? MaxPerRun { get; init; }
}

public class UpdateSuggestionSourceCommandHandler : IRequestHandler<UpdateSuggestionSourceCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IFaviconFetcher _favicons;

    public UpdateSuggestionSourceCommandHandler(IApplicationDbContext context, IFaviconFetcher favicons)
    {
        _context = context;
        _favicons = favicons;
    }

    public async Task Handle(UpdateSuggestionSourceCommand request, CancellationToken cancellationToken)
    {
        var source = await _context.SuggestionSources
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, source);

        source.Rename(request.Name);
        source.SetHost(request.Host);
        source.SetEnabled(request.Enabled);
        source.SetListingUrls(request.ListingUrls);
        source.SetMaxPerRun(request.MaxPerRun);

        // Refresh the favicon on every edit, so existing sources get one by re-saving.
        source.SetFavicon(await _favicons.FetchAsync(source.Host, cancellationToken));

        await _context.SaveChangesAsync(cancellationToken);
    }
}
