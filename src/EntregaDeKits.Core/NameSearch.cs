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
        => Matches(name, number, null, query);

    /// <summary>
    /// Nome, número ou CHIP.
    ///
    /// O CHIP entrou aqui porque a leitora de mesa digita o código no campo de
    /// busca do balcão, e a busca só comparava nome e número: passar o chip do
    /// corredor nunca encontrava ninguém. A comparação usa as escritas
    /// plausíveis do identificador, então o EPC hexadecimal da etiqueta
    /// reconhece o CHIP decimal da planilha.
    /// </summary>
    public static bool Matches(string? name, string? number, string? chip, string query)
    {
        var foldedQuery = Fold(query);
        if (foldedQuery.Length == 0) return false;
        if (Fold(name).Contains(foldedQuery, StringComparison.Ordinal)) return true;
        if (!string.IsNullOrWhiteSpace(number) && number.Contains(query.Trim(), StringComparison.OrdinalIgnoreCase)) return true;

        // Só vale a pena tratar como código quando não há espaço: nome com
        // espaço nunca é etiqueta, e a conversão numérica seria desperdício.
        var trimmed = query.Trim();
        if (trimmed.Length < 3 || trimmed.Contains(' ')) return false;

        return PassageKeys.SameIdentifier(chip, trimmed);
    }

    /// <summary>O identificador aponta para um corredor só?</summary>
    public static bool IsIdentifierOf(string? number, string? chip, string query)
    {
        var trimmed = (query ?? string.Empty).Trim();
        if (trimmed.Length < 3 || trimmed.Contains(' ')) return false;

        return PassageKeys.SameIdentifier(chip, trimmed) || PassageKeys.SameIdentifier(number, trimmed);
    }
}
