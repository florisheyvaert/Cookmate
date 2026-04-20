using System.Globalization;
using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Infrastructure.Scraping;

/// <summary>
/// Parses a free-text ingredient line such as "100 gram rozijnen" or "0,5 deciliter rum"
/// into amount + canonical unit + name + optional notes (anything after the first comma).
/// Tokenizes on whitespace and looks the second token up in a Dutch/English unit alias table.
/// Anything that's not a recognised unit becomes part of the name.
/// </summary>
internal static class IngredientLineParser
{
    // Aliases on the left → canonical short form on the right.
    // All keys must be lowercase; lookup is case-insensitive via dictionary's comparer.
    private static readonly IReadOnlyDictionary<string, string> UnitAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // mass
            ["g"] = "g", ["gr"] = "g", ["gram"] = "g", ["grammen"] = "g",
            ["kg"] = "kg", ["kilo"] = "kg", ["kilogram"] = "kg",
            ["mg"] = "mg",
            // volume
            ["ml"] = "ml", ["milliliter"] = "ml",
            ["cl"] = "cl", ["centiliter"] = "cl",
            ["dl"] = "dl", ["deciliter"] = "dl",
            ["l"] = "l", ["liter"] = "l", ["liters"] = "l",
            // spoons (Dutch + English)
            ["tl"] = "tl", ["theelepel"] = "tl", ["tsp"] = "tl", ["koffielepel"] = "tl", ["kl"] = "tl",
            ["el"] = "el", ["eetlepel"] = "el", ["tbsp"] = "el", ["soeplepel"] = "el",
            // misc
            ["cup"] = "cup", ["cups"] = "cup",
            ["stuk"] = "st", ["stuks"] = "st", ["st"] = "st",
            ["snuf"] = "snufje", ["snufje"] = "snufje",
            ["teen"] = "teen", ["tenen"] = "teen",
            ["bos"] = "bos", ["bosje"] = "bos",
        };

    public static ScrapedIngredient Parse(string line)
    {
        var trimmed = NormaliseWhitespace(line.Trim());
        if (trimmed.Length == 0) return new ScrapedIngredient { Name = "" };

        // Split off notes after the first comma — typical: "witte kool, fijn gesneden".
        string? notes = null;
        var commaIndex = trimmed.IndexOf(',');
        // A leading decimal like "0,5 dl" must not be treated as a comma split.
        if (commaIndex > 0 && !LooksLikeDecimalComma(trimmed, commaIndex))
        {
            notes = trimmed[(commaIndex + 1)..].Trim();
            trimmed = trimmed[..commaIndex].Trim();
        }

        var tokens = trimmed.Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length == 0) return new ScrapedIngredient { Name = "", Notes = notes };

        // Try to parse the first token as an amount.
        var amount = ParseAmount(tokens[0]);
        if (amount is null)
        {
            // No leading number — entire line is the name (e.g. "zout", "bloem").
            return new ScrapedIngredient { Name = trimmed, Notes = notes };
        }

        if (tokens.Length == 1)
        {
            return new ScrapedIngredient { Amount = amount.Value, Name = "", Notes = notes };
        }

        var rest = tokens.Length > 2 ? tokens[2] : "";

        if (UnitAliases.TryGetValue(tokens[1], out var canonicalUnit))
        {
            return new ScrapedIngredient
            {
                Amount = amount.Value,
                Unit = canonicalUnit,
                Name = rest,
                Notes = notes,
            };
        }

        // Second token isn't a known unit → treat it as the start of the name.
        var name = tokens.Length > 2 ? $"{tokens[1]} {rest}" : tokens[1];
        return new ScrapedIngredient
        {
            Amount = amount.Value,
            Name = name,
            Notes = notes,
        };
    }

    private static decimal? ParseAmount(string token)
    {
        // Range "1-2" → take the lower bound.
        if (token.Contains('-'))
        {
            var parts = token.Split('-', 2);
            return ParseAmount(parts[0]);
        }

        // Fraction "1/2".
        if (token.Contains('/'))
        {
            var parts = token.Split('/', 2);
            if (decimal.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var num)
                && decimal.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out var den)
                && den != 0)
            {
                return Math.Round(num / den, 4);
            }
            return null;
        }

        // Decimal — accept both "." and ",".
        var normalised = token.Replace(',', '.');
        return decimal.TryParse(normalised, NumberStyles.Any, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static bool LooksLikeDecimalComma(string text, int commaIndex)
    {
        // "0,5 dl rum" — comma is between digits.
        if (commaIndex == 0 || commaIndex == text.Length - 1) return false;
        return char.IsDigit(text[commaIndex - 1]) && char.IsDigit(text[commaIndex + 1]);
    }

    private static string NormaliseWhitespace(string text)
    {
        // Collapse all runs of whitespace (incl. NBSP) to a single space.
        var chars = new System.Text.StringBuilder(text.Length);
        var prevWasSpace = false;
        foreach (var c in text)
        {
            var isSpace = char.IsWhiteSpace(c);
            if (isSpace)
            {
                if (!prevWasSpace) chars.Append(' ');
                prevWasSpace = true;
            }
            else
            {
                chars.Append(c);
                prevWasSpace = false;
            }
        }
        return chars.ToString().Trim();
    }
}
