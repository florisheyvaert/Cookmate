using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;

namespace Cookmate.Application.Recipes.Commands.ImportRecipeFromUrl;

/// <summary>
/// Scrapes a public recipe page, persists a draft recipe with the parsed metadata,
/// downloads the image (best-effort), and returns the new recipe id.
/// The frontend redirects the user to the edit form so they can review/tweak.
/// </summary>
public record ImportRecipeFromUrlCommand : IRequest<int>
{
    public string Url { get; init; } = string.Empty;
}

public class ImportRecipeFromUrlCommandHandler : IRequestHandler<ImportRecipeFromUrlCommand, int>
{
    private readonly IRecipeScraper _scraper;
    private readonly IImageDownloader _imageDownloader;
    private readonly IApplicationDbContext _context;

    public ImportRecipeFromUrlCommandHandler(
        IRecipeScraper scraper,
        IImageDownloader imageDownloader,
        IApplicationDbContext context)
    {
        _scraper = scraper;
        _imageDownloader = imageDownloader;
        _context = context;
    }

    public async Task<int> Handle(ImportRecipeFromUrlCommand request, CancellationToken cancellationToken)
    {
        var uri = new Uri(request.Url);
        var scraped = await _scraper.ScrapeAsync(uri, cancellationToken);

        var title = string.IsNullOrWhiteSpace(scraped.Title) ? uri.Host : scraped.Title;
        var recipe = new Recipe(title, scraped.BaseServings, scraped.Summary, scraped.SourceUrl);
        recipe.SetTotalTimeMinutes(scraped.TotalTimeMinutes);

        foreach (var ingredient in scraped.Ingredients)
        {
            recipe.AddIngredient(
                ingredient.Name,
                new Quantity(ingredient.Amount, ingredient.Unit),
                ingredient.Notes);
        }

        foreach (var step in scraped.Steps)
        {
            recipe.AddStep(step);
        }

        recipe.SetTags(scraped.Tags);

        if (!string.IsNullOrWhiteSpace(scraped.ImageUrl)
            && Uri.TryCreate(scraped.ImageUrl, UriKind.Absolute, out var imageUri))
        {
            var media = await _imageDownloader.DownloadAsync(imageUri, cancellationToken);
            if (media is not null)
            {
                recipe.AddMedia(media.StorageKey, media.Type);
            }
        }

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync(cancellationToken);

        return recipe.Id;
    }
}
