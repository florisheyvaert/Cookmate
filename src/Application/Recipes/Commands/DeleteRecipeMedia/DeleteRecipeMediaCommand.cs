using Cookmate.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Cookmate.Application.Recipes.Commands.DeleteRecipeMedia;

public record DeleteRecipeMediaCommand(int RecipeId, int MediaId) : IRequest;

public class DeleteRecipeMediaCommandHandler : IRequestHandler<DeleteRecipeMediaCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IFileStorage _storage;
    private readonly ILogger<DeleteRecipeMediaCommandHandler> _logger;

    public DeleteRecipeMediaCommandHandler(
        IApplicationDbContext context,
        IFileStorage storage,
        ILogger<DeleteRecipeMediaCommandHandler> logger)
    {
        _context = context;
        _storage = storage;
        _logger = logger;
    }

    public async Task Handle(DeleteRecipeMediaCommand request, CancellationToken cancellationToken)
    {
        var recipe = await _context.Recipes
            .Include(r => r.Media)
            .FirstOrDefaultAsync(r => r.Id == request.RecipeId, cancellationToken);

        Guard.Against.NotFound(request.RecipeId, recipe);

        var media = recipe.Media.FirstOrDefault(m => m.Id == request.MediaId);
        Guard.Against.NotFound(request.MediaId, media);

        var storageKey = media.LocalPath;

        recipe.RemoveMedia(media);
        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await _storage.DeleteAsync(storageKey, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete media file '{Key}' after DB removal.", storageKey);
        }
    }
}
