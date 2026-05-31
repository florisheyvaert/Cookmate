namespace Cookmate.Application.Shopping.Commands.LinkIngredientToProduct;

public class LinkIngredientToProductCommandValidator : AbstractValidator<LinkIngredientToProductCommand>
{
    public LinkIngredientToProductCommandValidator()
    {
        RuleFor(c => c.IngredientId).GreaterThan(0);
        RuleFor(c => c.StoreCode).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Sku).NotEmpty().MaximumLength(64);
        RuleFor(c => c.DefaultPackQuantity).GreaterThan(0).LessThanOrEqualTo(99);
    }
}
