using Cookmate.Application.Recipes.Commands.CreateRecipe;

namespace Cookmate.Application.Recipes.Commands.UpdateRecipe;

public class UpdateRecipeCommandValidator : AbstractValidator<UpdateRecipeCommand>
{
    public UpdateRecipeCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0);

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200);

        RuleFor(x => x.BaseServings)
            .GreaterThan(0).WithMessage("Base servings must be at least 1.");

        RuleFor(x => x.Summary).MaximumLength(2000);
        RuleFor(x => x.SourceUrl).MaximumLength(2048);

        RuleFor(x => x.TotalTimeMinutes)
            .GreaterThanOrEqualTo(0).When(x => x.TotalTimeMinutes.HasValue)
            .LessThanOrEqualTo(60 * 24).When(x => x.TotalTimeMinutes.HasValue)
            .WithMessage("Total time must be between 0 minutes and 24 hours.");

        RuleForEach(x => x.Ingredients).SetValidator(new CreateRecipeIngredientValidator());

        RuleForEach(x => x.Steps)
            .NotEmpty().WithMessage("Step instruction cannot be empty.")
            .MaximumLength(2000);

        RuleFor(x => x.Tags)
            .Must(t => t.Count <= 10).WithMessage("At most 10 tags per recipe.");
        RuleForEach(x => x.Tags).MaximumLength(50);
    }
}
