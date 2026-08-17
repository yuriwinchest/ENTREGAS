using System.Globalization;
using System.Text;

namespace EntregaDeKits.Core;

public static class NameSearch
{
    public static string Fold(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(character) || char.IsWhiteSpace(character))
                builder.Append(char.ToLowerInvariant(character));
        }

        return string.Join(' ', builder.ToString().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    public static bool Matches(string? name, string? number, string query)
    {
        var foldedQuery = Fold(query);
        if (foldedQuery.Length == 0) return false;
        if (Fold(name).Contains(foldedQuery, StringComparison.Ordinal)) return true;
        return !string.IsNullOrWhiteSpace(number) && number.Contains(query.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
