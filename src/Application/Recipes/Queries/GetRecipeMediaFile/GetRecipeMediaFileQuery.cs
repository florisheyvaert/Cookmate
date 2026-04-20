using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.Recipes.Queries.GetRecipeMediaFile;

public record GetRecipeMediaFileQuery(int RecipeId, int MediaId) : IRequest<MediaFileInfo>;

public record MediaFileInfo(string StorageKey, string ContentType);

public class GetRecipeMediaFileQueryHandler : IRequestHandler<GetRecipeMediaFileQuery, MediaFileInfo>
{
    private readonly IApplicationDbContext _context;

    public GetRecipeMediaFileQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<MediaFileInfo> Handle(GetRecipeMediaFileQuery request, CancellationToken cancellationToken)
    {
        var media = await _context.Recipes
            .AsNoTracking()
            .Where(r => r.Id == request.RecipeId)
            .SelectMany(r => r.Media)
            .FirstOrDefaultAsync(m => m.Id == request.MediaId, cancellationToken);

        Guard.Against.NotFound(request.MediaId, media);

        return new MediaFileInfo(media.LocalPath, ContentTypeFor(media.LocalPath, media.Type));
    }

    private static string ContentTypeFor(string storageKey, MediaType type)
    {
        var extension = Path.GetExtension(storageKey).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            _ => type == MediaType.Video ? "application/octet-stream" : "application/octet-stream"
        };
    }
}
