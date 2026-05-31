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
    }

    /// <summary>Sets a free-text meal description and clears any recipe link.</summary>
    public void SetFreeText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Free text is required.", nameof(text));
        }

        FreeText = text.Trim();
        RecipeId = null;
        Servings = null;
    }

    public void SetSlot(MealSlot slot) => Slot = slot;

    public void Reschedule(DateOnly date) => Date = date;

    public void SetNotes(string? notes) =>
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
}
