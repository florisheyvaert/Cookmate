namespace Cookmate.Application.Shopping.Commands.SetIngredientProductPreference;

public class SetIngredientProductPreferenceCommandValidator : AbstractValidator<SetIngredientProductPreferenceCommand>
{
    public SetIngredientProductPreferenceCommandValidator()
    {
        RuleFor(x => x.StoreCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.IngredientName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(64);
        RuleFor(x => x.DefaultPackQuantity).GreaterThan(0).LessThanOrEqualTo(99);
    }
}
