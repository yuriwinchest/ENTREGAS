using System.Text;
using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

public sealed class TextParticipantImporter
{
    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        var text = ReadDocument(path);
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (lines.Length == 0) throw new InvalidDataException("O arquivo de texto está vazio.");

        var delimiter = DetectDelimiter(lines[0]);
        var rows = lines.Select(line => SplitLine(line, delimiter)).Where(row => row.Count > 0).ToArray();
        return TabularParticipantParser.Parse(rows);
    }

    private static byte[] LerBytesCompartilhado(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var memoria = new MemoryStream();
        stream.CopyTo(memoria);
        return memoria.ToArray();
    }

    internal static string ReadDocument(string path)
    {
        // Compartilhado: o arquivo pode estar aberto no Excel ou no Bloco de
        // Notas na hora de anexar, e aqui só se lê.
        var bytes = LerBytesCompartilhado(path);
        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
        try
        {
            return utf8.GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1252).GetString(bytes);
        }
    }

    internal static char DetectDelimiter(string header)
    {
        var candidates = new[] { ';', '\t', '|', ',' };
        var best = candidates.MaxBy(candidate => header.Count(item => item == candidate));
        return header.Contains(best) ? best : ';';
    }

    private static IReadOnlyList<string> SplitLine(string line, char delimiter)
    {
        if (delimiter != ',') return line.Split(delimiter).Select(item => item.Trim().Trim('"')).ToArray();

        var cells = new List<string>();
        var current = new StringBuilder();
        var quoted = false;
        foreach (var character in line)
        {
            if (character == '"') { quoted = !quoted; continue; }
            if (character == ',' && !quoted) { cells.Add(current.ToString().Trim()); current.Clear(); continue; }
            current.Append(character);
        }
        cells.Add(current.ToString().Trim());
        return cells;
    }
}
