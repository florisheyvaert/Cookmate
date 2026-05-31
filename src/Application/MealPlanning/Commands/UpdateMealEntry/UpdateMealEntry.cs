using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;

namespace Cookmate.Application.MealPlanning.Commands.UpdateMealEntry;

public record UpdateMealEntryCommand : IRequest
{
    public int Id { get; init; }

    public DateOnly Date { get; init; }

    public MealSlot Slot { get; init; } = MealSlot.Dinner;

    public int? RecipeId { get; init; }

    public string? FreeText { get; init; }

    public int? Servings { get; init; }

    public string? Notes { get; init; }
}

public class UpdateMealEntryCommandHandler : IRequestHandler<UpdateMealEntryCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateMealEntryCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UpdateMealEntryCommand request, CancellationToken cancellationToken)
    {
        var entry = await _context.MealEntries
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entry);

        entry.Reschedule(request.Date);
        entry.SetSlot(request.Slot);

        if (request.RecipeId is { } recipeId)
        {
            entry.AssignRecipe(recipeId, request.Servings);
        }
        else
        {
            entry.SetFreeText(request.FreeText!);
        }

        entry.SetNotes(request.Notes);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
