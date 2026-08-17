using System.Numerics;
using System.Text;
using System.Text.RegularExpressions;

namespace EntregaDeKits.Core;

public sealed partial class ChipIdentifierResolver : IChipIdentifierResolver
{
    public IReadOnlyList<string> GetCandidates(string epc)
    {
        var normalized = Normalize(epc);
        if (string.IsNullOrWhiteSpace(normalized)) return [];

        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { normalized };
        if (FullEpcHex().IsMatch(normalized))
        {
            var number = BigInteger.Parse("0" + normalized, System.Globalization.NumberStyles.AllowHexSpecifier);
            candidates.Add(number.ToString(System.Globalization.CultureInfo.InvariantCulture));

            var bytes = Convert.FromHexString(normalized);
            var ascii = Encoding.ASCII.GetString(bytes).Trim('\0', ' ');
            if (CleanIdentifier().IsMatch(ascii)) candidates.Add(ascii);
        }
        return candidates.ToArray();
    }

    public static string Normalize(string value) => string.Concat((value ?? string.Empty).Where(character => !char.IsWhiteSpace(character))).ToUpperInvariant();

    [GeneratedRegex("^[0-9A-F]{24}$")] private static partial Regex FullEpcHex();
    [GeneratedRegex("^[A-Za-z0-9_-]+$")] private static partial Regex CleanIdentifier();
}
