using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;

namespace Cookmate.Application.Recipes.Commands.CreateRecipe;

public record CreateRecipeCommand : IRequest<int>
{
    public string Title { get; init; } = string.Empty;

    public int BaseServings { get; init; }

    public string? Summary { get; init; }

    public string? SourceUrl { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<CreateRecipeIngredient> Ingredients { get; init; } = [];

    public IReadOnlyList<string> Steps { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];
}

public record CreateRecipeIngredient
{
    public string Name { get; init; } = string.Empty;

    public decimal Amount { get; init; }

    public string? Unit { get; init; }

    public string? Notes { get; init; }
}

public class CreateRecipeCommandHandler : IRequestHandler<CreateRecipeCommand, int>
{
    private readonly IApplicationDbContext _context;

    public CreateRecipeCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(CreateRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = new Recipe(request.Title, request.BaseServings, request.Summary, request.SourceUrl);
        recipe.SetTotalTimeMinutes(request.TotalTimeMinutes);

        foreach (var ingredient in request.Ingredients)
        {
            recipe.AddIngredient(
                ingredient.Name,
                new Quantity(ingredient.Amount, ingredient.Unit),
                ingredient.Notes);
        }

        foreach (var step in request.Steps)
        {
            recipe.AddStep(step);
        }

        recipe.SetTags(request.Tags);

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync(cancellationToken);

        return recipe.Id;
    }
}
