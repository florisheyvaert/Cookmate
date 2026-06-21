using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.Shopping.Common;

namespace Cookmate.Application.Shopping.Queries.GetWeeklyCart;

/// <summary>Builds the shopping cart for everything planned in [From, To] for one store.</summary>
public record GetWeeklyCartQuery : IRequest<WeeklyCartDto>
{
    public string StoreCode { get; init; } = string.Empty;

    public DateOnly From { get; init; }

    public DateOnly To { get; init; }
}

public class GetWeeklyCartQueryHandler : IRequestHandler<GetWeeklyCartQuery, WeeklyCartDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IGroceryStoreRegistry _stores;

    public GetWeeklyCartQueryHandler(IApplicationDbContext context, IGroceryStoreRegistry stores)
    {
        _context = context;
        _stores = stores;
    }

    public async Task<WeeklyCartDto> Handle(GetWeeklyCartQuery request, CancellationToken cancellationToken)
    {
        var store = _stores.Find(request.StoreCode);
        Guard.Against.NotFound(request.StoreCode, store);

        return await WeeklyCartBuilder.BuildAsync(_context, store, request.From, request.To, cancellationToken);
    }
}
