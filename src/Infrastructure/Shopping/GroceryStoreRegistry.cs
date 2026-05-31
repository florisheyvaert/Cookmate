using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Shopping;

public class GroceryStoreRegistry : IGroceryStoreRegistry
{
    private readonly Dictionary<string, IGroceryStore> _byCode;

    public GroceryStoreRegistry(IEnumerable<IGroceryStore> stores)
    {
        _byCode = stores.ToDictionary(s => s.Code, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyList<IGroceryStore> All() => _byCode.Values.ToList();

    public IGroceryStore? Find(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        return _byCode.TryGetValue(code.Trim(), out var store) ? store : null;
    }
}
