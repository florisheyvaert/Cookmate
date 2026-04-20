namespace Cookmate.Domain.Entities;

public class Ingredient : BaseEntity
{
    public int RecipeId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public Quantity Quantity { get; private set; } = new(0, null);

    public string? Notes { get; private set; }

    public int Order { get; private set; }

    private Ingredient() { }

    internal Ingredient(string name, Quantity quantity, int order, string? notes = null)
    {
        Rename(name);
        SetQuantity(quantity);
        Order = order;
        Notes = notes;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Ingredient name is required.", nameof(name));
        }

        Name = name.Trim();
    }

    public void SetQuantity(Quantity quantity)
    {
        ArgumentNullException.ThrowIfNull(quantity);
        Quantity = quantity;
    }

    public void SetNotes(string? notes) => Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    internal void SetOrder(int order) => Order = order;
}
