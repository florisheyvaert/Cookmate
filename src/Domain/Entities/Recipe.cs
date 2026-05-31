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

    /// <summary>
    /// Replaces the ingredient list with the supplied set, preserving entity
    /// identity for items the caller marks with an existing <c>Id</c>. Items
    /// not referenced are removed; new items (Id = null/0) are inserted.
    /// Order is taken from the input list. Used by the recipe-update flow so
    /// per-ingredient product links survive a save.
    /// </summary>
    public void ReplaceIngredients(IReadOnlyList<IngredientUpdate> updates)
    {
        ArgumentNullException.ThrowIfNull(updates);

        var preserveIds = updates
            .Where(u => u.Id is > 0)
            .Select(u => u.Id!.Value)
            .ToHashSet();

        // Remove existing ingredients no longer present.
        _ingredients.RemoveAll(e => e.Id > 0 && !preserveIds.Contains(e.Id));

        // Match-or-create per input position.
        var rebuilt = new List<Ingredient>(updates.Count);
        for (var idx = 0; idx < updates.Count; idx++)
        {
            var u = updates[idx];
            Ingredient? entity = u.Id is { } id and > 0
                ? _ingredients.FirstOrDefault(e => e.Id == id)
                : null;

            if (entity is null)
            {
                entity = new Ingredient(u.Name, u.Quantity, idx, u.Notes);
            }
            else
            {
                entity.Rename(u.Name);
                entity.SetQuantity(u.Quantity);
                entity.SetNotes(u.Notes);
                entity.SetOrder(idx);
            }

            rebuilt.Add(entity);
        }

        _ingredients.Clear();
        foreach (var e in rebuilt) _ingredients.Add(e);
    }

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
