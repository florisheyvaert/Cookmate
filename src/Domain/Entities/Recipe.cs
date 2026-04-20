namespace Cookmate.Domain.Entities;

public class Recipe : BaseAuditableEntity
{
    private readonly List<Ingredient> _ingredients = new();
    private readonly List<RecipeStep> _steps = new();
    private readonly List<RecipeMedia> _media = new();
    private readonly List<string> _tags = new();

    public string Title { get; private set; } = string.Empty;

    public string? Summary { get; private set; }

    public string? SourceUrl { get; private set; }

    public int BaseServings { get; private set; }

    public int? TotalTimeMinutes { get; private set; }

    public IReadOnlyCollection<Ingredient> Ingredients => _ingredients.AsReadOnly();

    public IReadOnlyCollection<RecipeStep> Steps => _steps.AsReadOnly();

    public IReadOnlyCollection<RecipeMedia> Media => _media.AsReadOnly();

    public IReadOnlyList<string> Tags => _tags.AsReadOnly();

    private Recipe() { }

    public Recipe(string title, int baseServings, string? summary = null, string? sourceUrl = null)
    {
        Rename(title);
        SetBaseServings(baseServings);
        SetSummary(summary);
        SetSourceUrl(sourceUrl);
    }

    public void Rename(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Recipe title is required.", nameof(title));
        }

        Title = title.Trim();
    }

    public void SetSummary(string? summary) =>
        Summary = string.IsNullOrWhiteSpace(summary) ? null : summary.Trim();

    public void SetSourceUrl(string? sourceUrl) =>
        SourceUrl = string.IsNullOrWhiteSpace(sourceUrl) ? null : sourceUrl.Trim();

    public void SetBaseServings(int servings)
    {
        if (servings < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(servings), "Base servings must be at least 1.");
        }

        BaseServings = servings;
    }

    public void SetTotalTimeMinutes(int? minutes)
    {
        if (minutes is < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(minutes), "Total time cannot be negative.");
        }

        TotalTimeMinutes = minutes is null or 0 ? null : minutes;
    }

    public void SetTags(IEnumerable<string> tags)
    {
        _tags.Clear();
        foreach (var raw in tags)
        {
            var normalised = NormaliseTag(raw);
            if (normalised is not null && !_tags.Contains(normalised))
            {
                _tags.Add(normalised);
            }
        }
    }

    private static string? NormaliseTag(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim().ToLowerInvariant();
        return trimmed.Length == 0 ? null : trimmed;
    }

    public decimal ScaleFactorFor(int targetServings)
    {
        if (targetServings < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(targetServings), "Target servings must be at least 1.");
        }

        return (decimal)targetServings / BaseServings;
    }

    public Ingredient AddIngredient(string name, Quantity quantity, string? notes = null)
    {
        var ingredient = new Ingredient(name, quantity, _ingredients.Count, notes);
        _ingredients.Add(ingredient);
        return ingredient;
    }

    public void RemoveIngredient(Ingredient ingredient)
    {
        if (_ingredients.Remove(ingredient))
        {
            Reindex(_ingredients, (i, o) => i.SetOrder(o));
        }
    }

    public void ClearIngredients() => _ingredients.Clear();

    public RecipeStep AddStep(string instruction)
    {
        var step = new RecipeStep(_steps.Count, instruction);
        _steps.Add(step);
        return step;
    }

    public void RemoveStep(RecipeStep step)
    {
        if (_steps.Remove(step))
        {
            Reindex(_steps, (s, o) => s.SetOrder(o));
        }
    }

    public void ClearSteps() => _steps.Clear();

    public RecipeMedia AddMedia(string localPath, MediaType type, string? caption = null)
    {
        var media = new RecipeMedia(localPath, type, _media.Count, caption);
        _media.Add(media);
        return media;
    }

    public void RemoveMedia(RecipeMedia media)
    {
        if (_media.Remove(media))
        {
            Reindex(_media, (m, o) => m.SetOrder(o));
        }
    }

    private static void Reindex<T>(List<T> items, Action<T, int> setOrder)
    {
        for (var i = 0; i < items.Count; i++)
        {
            setOrder(items[i], i);
        }
    }
}
