using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.MealPlanning.Commands.CreateMealEntry;

public record CreateMealEntryCommand : IRequest<int>
{
    public DateOnly Date { get; init; }

    public MealSlot Slot { get; init; } = MealSlot.Dinner;

    /// <summary>Set this for a recipe entry; leave null and set <see cref="FreeText"/> for a free-text entry.</summary>
    public int? RecipeId { get; init; }

    /// <summary>Free-text meal description (e.g. "spaghetti"); mutually exclusive with <see cref="RecipeId"/>.</summary>
    public string? FreeText { get; init; }

    public int? Servings { get; init; }

    public string? Notes { get; init; }
}

public class CreateMealEntryCommandHandler : IRequestHandler<CreateMealEntryCommand, int>
{
    private readonly IApplicationDbContext _context;

    public CreateMealEntryCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(CreateMealEntryCommand request, CancellationToken cancellationToken)
    {
        var entry = new MealEntry(request.Date, request.Slot);

        if (request.RecipeId is { } recipeId)
        {
            entry.AssignRecipe(recipeId, request.Servings);
        }
        else
        {
            entry.SetFreeText(request.FreeText!);
        }

        entry.SetNotes(request.Notes);

        _context.MealEntries.Add(entry);
        await _context.SaveChangesAsync(cancellationToken);

        return entry.Id;
    }
}
