using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.MealPlanning.Commands.DeleteMealEntry;

public record DeleteMealEntryCommand(int Id) : IRequest;

public class DeleteMealEntryCommandHandler : IRequestHandler<DeleteMealEntryCommand>
{
    private readonly IApplicationDbContext _context;

    public DeleteMealEntryCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(DeleteMealEntryCommand request, CancellationToken cancellationToken)
    {
        var entry = await _context.MealEntries
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entry);

        _context.MealEntries.Remove(entry);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
