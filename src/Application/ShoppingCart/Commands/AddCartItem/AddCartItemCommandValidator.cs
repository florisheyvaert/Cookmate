namespace Cookmate.Application.ShoppingCart.Commands.AddCartItem;

public class AddCartItemCommandValidator : AbstractValidator<AddCartItemCommand>
{
    public AddCartItemCommandValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Give the item a name.")
            .MaximumLength(300);

        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
