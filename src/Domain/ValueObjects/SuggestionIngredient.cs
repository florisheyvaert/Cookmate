namespace Cookmate.Domain.ValueObjects;

/// <summary>
/// A single parsed ingredient line captured when a suggestion was scraped. This
/// is a flat snapshot (not the <see cref="Entities.Ingredient"/> aggregate child)
/// stored as JSON on the suggestion, so promoting a suggestion to a real recipe
/// later needs no re-scrape.
/// </summary>
public record SuggestionIngredient(string Name, decimal Amount, string? Unit, string? Notes);
