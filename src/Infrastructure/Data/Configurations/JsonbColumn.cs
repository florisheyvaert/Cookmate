using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Cookmate.Infrastructure.Data.Configurations;

/// <summary>
/// Helpers for persisting a read-only list snapshot as a PostgreSQL <c>jsonb</c>
/// column. Used for the suggestion payload (ingredients/steps) and the harvest-run
/// report — data we store and read back whole, never query into, so a JSON blob is
/// the simplest faithful representation.
/// </summary>
internal static class JsonbColumn
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static ValueConverter<IReadOnlyList<T>, string> Converter<T>() => new(
        v => JsonSerializer.Serialize(v, Options),
        v => JsonSerializer.Deserialize<List<T>>(v, Options) ?? new List<T>());

    public static ValueComparer<IReadOnlyList<T>> Comparer<T>() => new(
        (a, b) => JsonSerializer.Serialize(a, Options) == JsonSerializer.Serialize(b, Options),
        v => v == null ? 0 : JsonSerializer.Serialize(v, Options).GetHashCode(),
        v => JsonSerializer.Deserialize<List<T>>(JsonSerializer.Serialize(v, Options), Options)!);
}
