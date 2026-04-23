namespace Cookmate.Application.Recipes.Commands.ImportRecipeMediaFromUrl;

public class ImportRecipeMediaFromUrlCommandValidator : AbstractValidator<ImportRecipeMediaFromUrlCommand>
{
    public ImportRecipeMediaFromUrlCommandValidator()
    {
        RuleFor(x => x.RecipeId).GreaterThan(0);

        RuleFor(x => x.Url)
            .NotEmpty().WithMessage("URL is required.")
            .Must(BeAbsoluteHttpUrl).WithMessage("URL must be an absolute http(s) address.");

        RuleFor(x => x.Caption).MaximumLength(500);
    }

    private static bool BeAbsoluteHttpUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
    }
}
