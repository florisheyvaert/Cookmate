using Cookmate.Domain.ValueObjects;

namespace Cookmate.Domain.Entities;

/// <summary>
/// A meal idea harvested from an external <see cref="SuggestionSource"/> — the
/// HelloFresh-style "pick from ~50 options" pool. These are deliberately NOT
/// <see cref="Recipe"/>s: they live in their own pool and can later be promoted
/// to a real recipe. The full scraped payload (ingredients, steps) is kept as a
/// snapshot so that promotion needs no re-scrape and survives the source page
/// changing. The cover image is downloaded to local storage at harvest time
/// (<see cref="ImageStorageKey"/>).
/// </summary>
public class MealSuggestion : BaseAuditableEntity
{
    private readonly List<string> _tags = new();
    private readonly List<SuggestionIngredient> _ingredients = new();
    private readonly List<string> _steps = new();

    public int SourceId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Summary { get; private set; }

    /// <summary>Canonical recipe page URL. Unique across the pool — the dedup key for harvesting.</summary>
    public string SourceUrl { get; private set; } = string.Empty;

    public int BaseServings { get; private set; } = 4;

    public int? TotalTimeMinutes { get; private set; }

    /// <summary>Local storage key for the downloaded cover image; null when none was available.</summary>
    public string? ImageStorageKey { get; private set; }

    /// <summary>The day this suggestion was harvested.</summary>
    public DateOnly HarvestedOn { get; private set; }

    public IReadOnlyList<string> Tags => _tags.AsReadOnly();

    public IReadOnlyList<SuggestionIngredient> Ingredients => _ingredients.AsReadOnly();

    public IReadOnlyList<string> Steps => _steps.AsReadOnly();

    private MealSuggestion() { }

    public MealSuggestion(int sourceId, string title, string sourceUrl, DateOnly harvestedOn, int baseServings = 4)
    {
        if (sourceId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(sourceId), "Source id must be positive.");
        }

        if (string.IsNullOrWhiteSpace(sourceUrl))
        {
            throw new ArgumentException("Source URL is required.", nameof(sourceUrl));
        }

        SourceId = sourceId;
        SourceUrl = sourceUrl.Trim();
        HarvestedOn = harvestedOn;
        SetTitle(title);
        SetBaseServings(baseServings);
    }

    public void SetTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Suggestion title is required.", nameof(title));
        }

        Title = title.Trim();
    }

    public void SetSummary(string? summary) =>
        Summary = string.IsNullOrWhiteSpace(summary) ? null : summary.Trim();

    public void SetBaseServings(int servings) =>
        BaseServings = servings < 1 ? 4 : servings;

    public void SetTotalTimeMinutes(int? minutes)
    {
        if (minutes is < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(minutes), "Total time cannot be negative.");
        }

        TotalTimeMinutes = minutes is null or 0 ? null : minutes;
    }

    public void SetImage(string? storageKey) =>
        ImageStorageKey = string.IsNullOrWhiteSpace(storageKey) ? null : storageKey.Trim();

    public void SetTags(IEnumerable<string> tags)
    {
        _tags.Clear();
        foreach (var raw in tags)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var normalised = raw.Trim().ToLowerInvariant();
            if (normalised.Length > 0 && !_tags.Contains(normalised))
            {
                _tags.Add(normalised);
            }
        }
    }

    public void SetIngredients(IEnumerable<SuggestionIngredient> ingredients)
    {
        _ingredients.Clear();
        foreach (var ingredient in ingredients)
        {
            if (!string.IsNullOrWhiteSpace(ingredient.Name))
            {
                _ingredients.Add(ingredient);
            }
        }
    }

    public void SetSteps(IEnumerable<string> steps)
    {
        _steps.Clear();
        foreach (var step in steps)
        {
            if (!string.IsNullOrWhiteSpace(step))
            {
                _steps.Add(step.Trim());
            }
        }
    }
}
