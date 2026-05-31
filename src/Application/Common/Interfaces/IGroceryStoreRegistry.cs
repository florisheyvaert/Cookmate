namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// Lookup table over registered <see cref="IGroceryStore"/> implementations.
/// </summary>
public interface IGroceryStoreRegistry
{
    IReadOnlyList<IGroceryStore> All();

    /// <summary>Returns the store with the given code, or <c>null</c> if unknown.</summary>
    IGroceryStore? Find(string code);
}
