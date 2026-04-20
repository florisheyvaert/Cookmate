namespace Cookmate.Application.Recipes.Commands.ImportRecipeFromUrl;

public class ImportRecipeFromUrlCommandValidator : AbstractValidator<ImportRecipeFromUrlCommand>
{
    public ImportRecipeFromUrlCommandValidator()
    {
        RuleFor(x => x.Url)
            .NotEmpty().WithMessage("URL is required.")
            .Must(BeAbsoluteHttpUrl).WithMessage("URL must be an absolute http(s) address.");
    }

    private static bool BeAbsoluteHttpUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
    }
}
