namespace Cookmate.Application.Shopping.Commands.LinkIngredientToProductByUrl;

public class LinkIngredientToProductByUrlCommandValidator : AbstractValidator<LinkIngredientToProductByUrlCommand>
{
    public LinkIngredientToProductByUrlCommandValidator()
    {
        RuleFor(c => c.IngredientId).GreaterThan(0);
        RuleFor(c => c.StoreCode).NotEmpty().MaximumLength(50);
        RuleFor(c => c.ProductUrl).NotEmpty().MaximumLength(2048);
        RuleFor(c => c.DefaultPackQuantity).GreaterThan(0).LessThanOrEqualTo(99);
    }
}
