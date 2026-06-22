using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetSuggestionSourceFavicon;

/// <summary>Returns the storage key + content type for a source's locally stored favicon.</summary>
public record GetSuggestionSourceFaviconQuery(int Id) : IRequest<SourceFaviconInfo>;

public record SourceFaviconInfo(string StorageKey, string ContentType);

public class GetSuggestionSourceFaviconQueryHandler : IRequestHandler<GetSuggestionSourceFaviconQuery, SourceFaviconInfo>
{
    private readonly IApplicationDbContext _context;

    public GetSuggestionSourceFaviconQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SourceFaviconInfo> Handle(GetSuggestionSourceFaviconQuery request, CancellationToken cancellationToken)
    {
        var key = await _context.SuggestionSources
            .AsNoTracking()
            .Where(s => s.Id == request.Id)
            .Select(s => s.FaviconStorageKey)
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, key);

        return new SourceFaviconInfo(key, ContentTypeFor(key));
    }

    private static string ContentTypeFor(string storageKey)
    {
        var extension = Path.GetExtension(storageKey).ToLowerInvariant();
        return extension switch
        {
            ".png" => "image/png",
            ".ico" => "image/x-icon",
            ".svg" => "image/svg+xml",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "application/octet-stream",
        };
    }
}
