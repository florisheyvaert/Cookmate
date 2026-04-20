namespace Cookmate.Application.Common.Interfaces;

public interface IRecipeScraper
{
    Task<ScrapedRecipe> ScrapeAsync(Uri url, CancellationToken cancellationToken);
}

public record ScrapedRecipe
{
    public string Title { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public int BaseServings { get; init; } = 4;

    public int? TotalTimeMinutes { get; init; }

    public string SourceUrl { get; init; } = string.Empty;

    public IReadOnlyList<ScrapedIngredient> Ingredients { get; init; } = [];

    public IReadOnlyList<string> Steps { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];

    public string? ImageUrl { get; init; }
}

public record ScrapedIngredient
{
    public string Name { get; init; } = string.Empty;

    public decimal Amount { get; init; }

    public string? Unit { get; init; }

    public string? Notes { get; init; }
}
