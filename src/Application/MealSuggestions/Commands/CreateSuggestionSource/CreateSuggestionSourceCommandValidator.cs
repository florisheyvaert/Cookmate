namespace Cookmate.Application.MealSuggestions.Commands.CreateSuggestionSource;

public class CreateSuggestionSourceCommandValidator : AbstractValidator<CreateSuggestionSourceCommand>
{
    public CreateSuggestionSourceCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A name is required.")
            .MaximumLength(100);

        RuleFor(x => x.Host)
            .NotEmpty().WithMessage("A host is required.")
            .MaximumLength(255);

        RuleFor(x => x.MaxPerRun)
            .GreaterThan(0).When(x => x.MaxPerRun.HasValue)
            .WithMessage("MaxPerRun must be at least 1.");

        RuleForEach(x => x.ListingUrls)
            .Must(BeAnAbsoluteHttpUrl).WithMessage("Each listing URL must be an absolute http(s) URL.");
    }

    private static bool BeAnAbsoluteHttpUrl(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
