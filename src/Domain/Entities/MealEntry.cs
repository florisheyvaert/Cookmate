namespace Cookmate.Domain.Entities;

/// <summary>
/// A single planned meal pinned to a calendar day and slot. The "weekmenu" is
/// just a collection of these entries viewed as a calendar — there is no named
/// plan aggregate. Each entry is filled in one of two mutually exclusive ways:
/// either it references a stored <see cref="Recipe"/> (with optional servings,
/// kept for the future shopping-basket link) or it carries free text such as
/// "spaghetti". The <see cref="AssignRecipe"/> / <see cref="SetFreeText"/>
/// methods enforce that XOR by clearing the other side.
/// Shared across the household — not user-scoped.
/// </summary>
public class MealEntry : BaseAuditableEntity
{
    public DateOnly Date { get; private set; }

    public MealSlot Slot { get; private set; } = MealSlot.Dinner;

    public int? RecipeId { get; private set; }

    public string? FreeText { get; private set; }

    /// <summary>
    /// Optional link to the harvested suggestion this free-text entry came from — kept so
    /// the plan can show the suggestion's photo (and, later, promote it to a real recipe).
    /// Null for hand-typed entries and recipe entries.
    /// </summary>
    public int? MealSuggestionId { get; private set; }

    /// <summary>Target servings for a recipe entry; null when free text or when left at the recipe default.</summary>
    public int? Servings { get; private set; }

    public string? Notes { get; private set; }

    private MealEntry() { }

    public MealEntry(DateOnly date, MealSlot slot)
    {
        Date = date;
        Slot = slot;
    }

    /// <summary>Points this entry at a stored recipe and clears any free text.</summary>
    public void AssignRecipe(int recipeId, int? servings = null)
    {
        if (recipeId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(recipeId), "Recipe id must be positive.");
        }

        if (servings is < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(servings), "Servings must be at least 1.");
        }

        RecipeId = recipeId;
        Servings = servings;
        FreeText = null;
        MealSuggestionId = null;
    }

    /// <summary>
    /// Sets a free-text meal description and clears any recipe link. Optionally records the
    /// harvested suggestion it came from (so the plan can show its photo) and the servings it
    /// was planned for (so the shopping cart can scale the suggestion's ingredients).
    /// </summary>
    public void SetFreeText(string text, int? suggestionId = null, int? servings = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Free text is required.", nameof(text));
        }

        if (servings is < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(servings), "Servings must be at least 1.");
        }

        FreeText = text.Trim();
        RecipeId = null;
        MealSuggestionId = suggestionId is > 0 ? suggestionId : null;
        // Keep servings only for a suggestion-backed entry; a hand-typed note has no recipe to scale.
        Servings = MealSuggestionId is not null ? servings : null;
    }

    public void SetSlot(MealSlot slot) => Slot = slot;

    public void Reschedule(DateOnly date) => Date = date;

    public void SetNotes(string? notes) =>
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
}
