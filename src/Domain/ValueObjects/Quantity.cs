namespace Cookmate.Domain.ValueObjects;

public class Quantity : ValueObject
{
    public decimal Amount { get; private set; }

    public string Unit { get; private set; }

    private Quantity() { Unit = string.Empty; }

    public Quantity(decimal amount, string? unit)
    {
        if (amount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "Quantity amount cannot be negative.");
        }

        Amount = amount;
        Unit = (unit ?? string.Empty).Trim();
    }

    public Quantity Scale(decimal factor)
    {
        if (factor < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(factor), "Scale factor cannot be negative.");
        }

        return new Quantity(Amount * factor, Unit);
    }

    public override string ToString() =>
        Unit.Length == 0 ? Amount.ToString() : $"{Amount} {Unit}";

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Unit;
    }
}
