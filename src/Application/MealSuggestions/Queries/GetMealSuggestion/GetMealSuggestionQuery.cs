using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetMealSuggestion;

/// <summary>Full detail of a single suggestion, including the scraped ingredients and steps,
/// so it can be viewed inside the app without leaving for the source site.</summary>
public record GetMealSuggestionQuery(int Id) : IRequest<MealSuggestionDetailDto>;

public class GetMealSuggestionQueryHandler : IRequestHandler<GetMealSuggestionQuery, MealSuggestionDetailDto>
{
    private readonly IApplicationDbContext _context;

    public GetMealSuggestionQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<MealSuggestionDetailDto> Handle(GetMealSuggestionQuery request, CancellationToken cancellationToken)
    {
        var suggestion = await _context.MealSuggestions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, suggestion);

        var sourceName = await _context.SuggestionSources
            .AsNoTracking()
            .Where(src => src.Id == suggestion.SourceId)
            .Select(src => src.Name)
            .FirstOrDefaultAsync(cancellationToken);

        return new MealSuggestionDetailDto
        {
            Id = suggestion.Id,
            Title = suggestion.Title,
            Summary = suggestion.Summary,
            SourceUrl = suggestion.SourceUrl,
            SourceId = suggestion.SourceId,
            SourceName = sourceName,
            BaseServings = suggestion.BaseServings,
            TotalTimeMinutes = suggestion.TotalTimeMinutes,
            Tags = suggestion.Tags,
            HarvestedOn = suggestion.HarvestedOn,
            ImageUrl = suggestion.ImageStorageKey is null ? null : $"/api/MealSuggestions/{suggestion.Id}/image",
            Ingredients = suggestion.Ingredients
                .Select(i => new SuggestionIngredientDto(i.Name, i.Amount, i.Unit, i.Notes))
                .ToList(),
            Steps = suggestion.Steps,
        };
    }
}

public record MealSuggestionDetailDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public string SourceUrl { get; init; } = string.Empty;

    public int SourceId { get; init; }

    public string? SourceName { get; init; }

    public int BaseServings { get; init; }

    public int? TotalTimeMinutes { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = [];

    public DateOnly HarvestedOn { get; init; }

    public string? ImageUrl { get; init; }

    public IReadOnlyList<SuggestionIngredientDto> Ingredients { get; init; } = [];

    public IReadOnlyList<string> Steps { get; init; } = [];
}

public record SuggestionIngredientDto(string Name, decimal Amount, string? Unit, string? Notes);
