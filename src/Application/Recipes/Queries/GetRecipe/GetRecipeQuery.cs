using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.Recipes.Queries.GetRecipe;

public record GetRecipeQuery : IRequest<RecipeDto>
{
    public int Id { get; init; }

    public int? Servings { get; init; }
}

public class GetRecipeQueryHandler : IRequestHandler<GetRecipeQuery, RecipeDto>
{
    private readonly IApplicationDbContext _context;

    public GetRecipeQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<RecipeDto> Handle(GetRecipeQuery request, CancellationToken cancellationToken)
    {
        var recipe = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.Ingredients)
            .Include(r => r.Steps)
            .Include(r => r.Media)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, recipe);

        var servedFor = request.Servings ?? recipe.BaseServings;
        var factor = recipe.ScaleFactorFor(servedFor);

        return new RecipeDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Summary = recipe.Summary,
            SourceUrl = recipe.SourceUrl,
            BaseServings = recipe.BaseServings,
            ServedFor = servedFor,
            TotalTimeMinutes = recipe.TotalTimeMinutes,
            Tags = recipe.Tags.ToList(),
            Ingredients = recipe.Ingredients
                .OrderBy(i => i.Order)
                .Select(i => new RecipeIngredientDto
                {
                    Id = i.Id,
                    Order = i.Order,
                    Name = i.Name,
                    Amount = i.Quantity.Scale(factor).Amount,
                    Unit = i.Quantity.Unit,
                    Notes = i.Notes
                })
                .ToList(),
            Steps = recipe.Steps
                .OrderBy(s => s.Order)
                .Select(s => new RecipeStepDto
                {
                    Id = s.Id,
                    Order = s.Order,
                    Instruction = s.Instruction
                })
                .ToList(),
            Media = recipe.Media
                .OrderBy(m => m.Order)
                .Select(m => new RecipeMediaDto
                {
                    Id = m.Id,
                    Order = m.Order,
                    Url = $"/api/Recipes/{recipe.Id}/media/{m.Id}/file",
                    Type = m.Type,
                    Caption = m.Caption
                })
                .ToList()
        };
    }
}

public record RecipeDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public string? SourceUrl { get; init; }

    public int BaseServings { get; init; }

    public int ServedFor { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = [];

    public IReadOnlyList<RecipeIngredientDto> Ingredients { get; init; } = [];

    public IReadOnlyList<RecipeStepDto> Steps { get; init; } = [];

    public IReadOnlyList<RecipeMediaDto> Media { get; init; } = [];
}

public record RecipeIngredientDto
{
    public int Id { get; init; }

    public int Order { get; init; }

    public string Name { get; init; } = string.Empty;

    public decimal Amount { get; init; }

    public string Unit { get; init; } = string.Empty;

    public string? Notes { get; init; }
}

public record RecipeStepDto
{
    public int Id { get; init; }

    public int Order { get; init; }

    public string Instruction { get; init; } = string.Empty;
}

public record RecipeMediaDto
{
    public int Id { get; init; }

    public int Order { get; init; }

    public string Url { get; init; } = string.Empty;

    public MediaType Type { get; init; }

    public string? Caption { get; init; }
}
