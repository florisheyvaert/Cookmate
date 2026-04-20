using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Recipes.Commands.CreateRecipe;
using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;

namespace Cookmate.Application.Recipes.Commands.UpdateRecipe;

public record UpdateRecipeCommand : IRequest
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public int BaseServings { get; init; }

    public string? Summary { get; init; }

    public string? SourceUrl { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<CreateRecipeIngredient> Ingredients { get; init; } = [];

    public IReadOnlyList<string> Steps { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];
}

public class UpdateRecipeCommandHandler : IRequestHandler<UpdateRecipeCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateRecipeCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UpdateRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = await _context.Recipes
            .Include(r => r.Ingredients)
            .Include(r => r.Steps)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, recipe);

        recipe.Rename(request.Title);
        recipe.SetBaseServings(request.BaseServings);
        recipe.SetSummary(request.Summary);
        recipe.SetSourceUrl(request.SourceUrl);
        recipe.SetTotalTimeMinutes(request.TotalTimeMinutes);

        recipe.ClearIngredients();
        foreach (var ingredient in request.Ingredients)
        {
            recipe.AddIngredient(
                ingredient.Name,
                new Quantity(ingredient.Amount, ingredient.Unit),
                ingredient.Notes);
        }

        recipe.ClearSteps();
        foreach (var step in request.Steps)
        {
            recipe.AddStep(step);
        }

        recipe.SetTags(request.Tags);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
