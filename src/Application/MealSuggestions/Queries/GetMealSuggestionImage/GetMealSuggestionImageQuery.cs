using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetMealSuggestionImage;

/// <summary>Returns the storage key + content type for a suggestion's locally stored cover image.</summary>
public record GetMealSuggestionImageQuery(int Id) : IRequest<SuggestionImageInfo>;

public record SuggestionImageInfo(string StorageKey, string ContentType);

public class GetMealSuggestionImageQueryHandler : IRequestHandler<GetMealSuggestionImageQuery, SuggestionImageInfo>
{
    private readonly IApplicationDbContext _context;

    public GetMealSuggestionImageQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SuggestionImageInfo> Handle(GetMealSuggestionImageQuery request, CancellationToken cancellationToken)
    {
        var key = await _context.MealSuggestions
            .AsNoTracking()
            .Where(s => s.Id == request.Id)
            .Select(s => s.ImageStorageKey)
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, key);

        return new SuggestionImageInfo(key, ContentTypeFor(key));
    }

    private static string ContentTypeFor(string storageKey)
    {
        var extension = Path.GetExtension(storageKey).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream",
        };
    }
}
