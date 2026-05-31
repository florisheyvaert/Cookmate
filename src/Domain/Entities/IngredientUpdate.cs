namespace Cookmate.Domain.Entities;

/// <summary>
/// Pure data shape passed into <see cref="Recipe.ReplaceIngredients"/>.
/// Lives in Domain because it's part of the aggregate's contract.
/// </summary>
public record IngredientUpdate(
    int? Id,
    string Name,
    Quantity Quantity,
    string? Notes);
