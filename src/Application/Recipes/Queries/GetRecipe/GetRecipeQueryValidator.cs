namespace Cookmate.Application.Recipes.Queries.GetRecipe;

public class GetRecipeQueryValidator : AbstractValidator<GetRecipeQuery>
{
    public GetRecipeQueryValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0);

        RuleFor(x => x.Servings)
            .GreaterThan(0).When(x => x.Servings.HasValue)
            .WithMessage("Servings must be at least 1.");
    }
}
