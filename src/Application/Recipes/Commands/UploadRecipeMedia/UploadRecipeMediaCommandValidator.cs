namespace Cookmate.Application.Recipes.Commands.UploadRecipeMedia;

public class UploadRecipeMediaCommandValidator : AbstractValidator<UploadRecipeMediaCommand>
{
    public UploadRecipeMediaCommandValidator()
    {
        RuleFor(x => x.RecipeId).GreaterThan(0);

        RuleFor(x => x.ContentType)
            .Must(ct => RecipeMediaRules.AllowedTypes.ContainsKey(ct))
            .WithMessage($"Unsupported content type. Allowed: {string.Join(", ", RecipeMediaRules.AllowedTypes.Keys)}.");

        RuleFor(x => x.LengthBytes)
            .GreaterThan(0).WithMessage("File is empty.")
            .LessThanOrEqualTo(RecipeMediaRules.MaxBytes)
            .WithMessage($"File exceeds the {RecipeMediaRules.MaxBytes / (1024 * 1024)} MB limit.");

        RuleFor(x => x.Caption).MaximumLength(500);
    }
}
