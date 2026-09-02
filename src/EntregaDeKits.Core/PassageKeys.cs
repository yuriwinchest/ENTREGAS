using System.Globalization;
using System.Numerics;
using System.Text;
using System.Text.RegularExpressions;

namespace EntregaDeKits.Core;

/// <summary>
/// Todas as formas comparáveis de um mesmo identificador de chip.
///
/// POR QUE ISTO EXISTE: a planilha do evento traz o CHIP como um número curto
/// e decimal (51921, 60651). A leitora de mesa, em modo teclado, digita o EPC
/// da etiqueta — normalmente 24 dígitos hexadecimais. São o mesmo chip escrito
/// de dois jeitos, e uma comparação literal jamais casaria.
///
/// A saída é gerar, dos DOIS lados, todas as escritas plausíveis do mesmo
/// número e procurar interseção. "51921" gera {51921, CAD1, 0000…CAD1} e o EPC
/// "00000000000000000000CAD1" gera {00000000000000000000CAD1, CAD1, 51921}:
/// eles se encontram.
///
/// A regra que evita falso positivo: uma cadeia só de dígitos NUNCA é lida como
/// hexadecimal. Sem isso "51921" seria também interpretado como 0x51921 =
/// 334113 e poderia casar com outro corredor. Dígito puro entra pelo caminho
/// decimal, e só por ele.
///
/// Esta classe é deliberadamente separada de <see cref="ChipIdentifierResolver"/>:
/// aquele governa o fluxo de entrega no balcão, já validado e coberto por
/// testes, e não vai mudar de comportamento por causa da tela de passagem.
/// </summary>
public static partial class PassageKeys
{
    /// <summary>Comprimento do EPC de 96 bits em caracteres hexadecimais.</summary>
    private const int EpcHexLength = 24;

    /// <summary>Abaixo disto, um hexadecimal é curto demais para valer conversão.</summary>
    private const int MinimumHexLength = 4;

    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

        var builder = new StringBuilder(raw.Length);
        foreach (var character in raw)
        {
            // Separadores que a leitora ou a planilha podem inserir por conta própria.
            if (char.IsWhiteSpace(character) || character is '-' or '.' or ':' or '_') continue;
            builder.Append(char.ToUpperInvariant(character));
        }
        return builder.ToString();
    }

    public static IReadOnlyList<string> Variants(string? raw)
    {
        var normalized = Normalize(raw);
        if (normalized.Length == 0) return [];

        var variants = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        void Add(string? candidate)
        {
            if (string.IsNullOrEmpty(candidate)) return;
            if (!seen.Add(candidate)) return;
            variants.Add(candidate);
        }

        Add(normalized);
        Add(StripLeadingZeros(normalized));

        var onlyDigits = OnlyDigits().IsMatch(normalized);
        var looksHex = OnlyHex().IsMatch(normalized) && normalized.Length >= MinimumHexLength;

        // Decimal da planilha -> o hexadecimal equivalente, cru e no formato de EPC.
        if (onlyDigits) AddDecimalForms(normalized, Add);

        // Hexadecimal da leitora -> o decimal equivalente. Só quando existe uma
        // letra A-F: dígito puro é sempre decimal, nunca relido como hexadecimal.
        if (looksHex && normalized.Any(character => character is >= 'A' and <= 'F'))
            AddHexAsDecimal(normalized, Add);

        // Etiqueta que grava o identificador como TEXTO dentro do EPC. Esta
        // leitura se autovalida — só vale se todos os bytes virarem caracteres
        // limpos — então pode ser tentada mesmo num EPC composto só de dígitos.
        if (looksHex && normalized.Length % 2 == 0) AddAsciiForm(normalized, Add);

        return variants;
    }

    private static void AddDecimalForms(string digits, Action<string?> add)
    {
        if (!BigInteger.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var value)) return;
        if (value <= BigInteger.Zero) return;

        var hex = value.ToString("X", CultureInfo.InvariantCulture).TrimStart('0');
        if (hex.Length == 0 || hex.Length > EpcHexLength) return;

        add(hex);
        add(hex.PadLeft(EpcHexLength, '0'));
    }

    private static void AddHexAsDecimal(string hex, Action<string?> add)
    {
        var value = BigInteger.Parse("0" + hex, NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
        add(value.ToString(CultureInfo.InvariantCulture));
    }

    private static void AddAsciiForm(string hex, Action<string?> add)
    {
        var ascii = Encoding.ASCII.GetString(Convert.FromHexString(hex)).Trim(NullChar, ' ');
        if (ascii.Length == 0 || !CleanIdentifier().IsMatch(ascii)) return;

        var normalized = Normalize(ascii);
        // Um EPC decimal cujo texto é o mesmo número não acrescenta informação.
        if (!string.Equals(normalized, hex, StringComparison.Ordinal)) add(normalized);
    }

    private const char NullChar = (char)0;

    private static string StripLeadingZeros(string value)
    {
        var trimmed = value.TrimStart('0');
        return trimmed.Length == 0 ? value : trimmed;
    }

    [GeneratedRegex("^[0-9]+$")] private static partial Regex OnlyDigits();
    [GeneratedRegex("^[0-9A-F]+$")] private static partial Regex OnlyHex();
    [GeneratedRegex("^[A-Za-z0-9_-]+$")] private static partial Regex CleanIdentifier();
}
