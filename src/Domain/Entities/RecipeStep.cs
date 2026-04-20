namespace Cookmate.Domain.Entities;

public class RecipeStep : BaseEntity
{
    public int RecipeId { get; private set; }

    public int Order { get; private set; }

    public string Instruction { get; private set; } = string.Empty;

    private RecipeStep() { }

    internal RecipeStep(int order, string instruction)
    {
        Order = order;
        Edit(instruction);
    }

    public void Edit(string instruction)
    {
        if (string.IsNullOrWhiteSpace(instruction))
        {
            throw new ArgumentException("Step instruction is required.", nameof(instruction));
        }

        Instruction = instruction.Trim();
    }

    internal void SetOrder(int order) => Order = order;
}
