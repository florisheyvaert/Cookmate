using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.Recipes.Commands.ImportRecipeMediaFromUrl;

public record ImportRecipeMediaFromUrlCommand : IRequest<int>
{
    public int RecipeId { get; init; }

    public string Url { get; init; } = string.Empty;

    public string? Caption { get; init; }
}

public class ImportRecipeMediaFromUrlCommandHandler : IRequestHandler<ImportRecipeMediaFromUrlCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IImageDownloader _imageDownloader;

    public ImportRecipeMediaFromUrlCommandHandler(
        IApplicationDbContext context,
        IImageDownloader imageDownloader)
    {
        _context = context;
        _imageDownloader = imageDownloader;
    }

    public async Task<int> Handle(ImportRecipeMediaFromUrlCommand request, CancellationToken cancellationToken)
    {
        var recipe = await _context.Recipes
            .Include(r => r.Media)
            .FirstOrDefaultAsync(r => r.Id == request.RecipeId, cancellationToken);

        Guard.Against.NotFound(request.RecipeId, recipe);

        var uri = new Uri(request.Url);
        var downloaded = await _imageDownloader.DownloadAsync(uri, cancellationToken);
        if (downloaded is null)
        {
            throw new InvalidOperationException(
                "Couldn't download an image from that URL. The link must return a jpeg, png, or webp image.");
        }

        var media = recipe.AddMedia(downloaded.StorageKey, downloaded.Type, request.Caption);

        await _context.SaveChangesAsync(cancellationToken);

        return media.Id;
    }
}
