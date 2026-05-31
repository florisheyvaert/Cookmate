namespace Cookmate.Application.MealPlanning.Commands.UpdateMealEntry;

public class UpdateMealEntryCommandValidator : AbstractValidator<UpdateMealEntryCommand>
{
    public UpdateMealEntryCommandValidator()
    {
        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("A date is required.");

        RuleFor(x => x.FreeText)
            .MaximumLength(200);

        RuleFor(x => x.Notes)
            .MaximumLength(500);

        RuleFor(x => x.Servings)
            .GreaterThan(0).When(x => x.Servings.HasValue)
            .WithMessage("Servings must be at least 1.");

        // Exactly one of RecipeId / FreeText must be supplied.
        RuleFor(x => x)
            .Must(x => (x.RecipeId is > 0) ^ !string.IsNullOrWhiteSpace(x.FreeText))
            .WithMessage("Provide either a recipe or free text, but not both.");
    }
}
