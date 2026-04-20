using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.Recipes.Commands.UploadRecipeMedia;

public record UploadRecipeMediaCommand : IRequest<int>
{
    public int RecipeId { get; init; }

    public Stream Content { get; init; } = Stream.Null;

    public string ContentType { get; init; } = string.Empty;

    public long LengthBytes { get; init; }

    public string? Caption { get; init; }
}

public static class RecipeMediaRules
{
    public const long MaxBytes = 50L * 1024 * 1024;

    public static readonly IReadOnlyDictionary<string, (MediaType Type, string Extension)> AllowedTypes
        = new Dictionary<string, (MediaType, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = (MediaType.Photo, ".jpg"),
            ["image/png"] = (MediaType.Photo, ".png"),
            ["image/webp"] = (MediaType.Photo, ".webp"),
            ["video/mp4"] = (MediaType.Video, ".mp4"),
            ["video/webm"] = (MediaType.Video, ".webm")
        };
}

public class UploadRecipeMediaCommandHandler : IRequestHandler<UploadRecipeMediaCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IFileStorage _storage;

    public UploadRecipeMediaCommandHandler(IApplicationDbContext context, IFileStorage storage)
    {
        _context = context;
        _storage = storage;
    }

    public async Task<int> Handle(UploadRecipeMediaCommand request, CancellationToken cancellationToken)
    {
        var mapping = RecipeMediaRules.AllowedTypes[request.ContentType];

        var recipe = await _context.Recipes
            .Include(r => r.Media)
            .FirstOrDefaultAsync(r => r.Id == request.RecipeId, cancellationToken);

        Guard.Against.NotFound(request.RecipeId, recipe);

        var key = await _storage.SaveAsync(request.Content, mapping.Extension, cancellationToken);

        var media = recipe.AddMedia(key, mapping.Type, request.Caption);

        await _context.SaveChangesAsync(cancellationToken);

        return media.Id;
    }
}
