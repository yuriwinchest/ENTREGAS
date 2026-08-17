using EntregaDeKits.Core;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace EntregaDeKits.Infrastructure;

public sealed class PdfParticipantImporter
{
    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        using var document = PdfDocument.Open(path);
        var lines = new List<string>();
        foreach (var page in document.GetPages())
            lines.AddRange(ExtractLines(page));

        if (lines.Count == 0) throw new InvalidDataException("O PDF não contém texto de corredores.");

        var rows = lines.Select(ToCells).Where(row => row.Count > 0).ToArray();
        return TabularParticipantParser.Parse(rows);
    }

    private static IReadOnlyList<string> ToCells(string line)
    {
        var delimiter = TextParticipantImporter.DetectDelimiter(line);
        if (line.Contains(delimiter))
            return line.Split(delimiter, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return [line];
    }

    private static IEnumerable<string> ExtractLines(Page page)
    {
        var words = page.GetWords().ToArray();
        if (words.Length == 0) yield break;

        var groups = words
            .GroupBy(word => Math.Round(word.BoundingBox.Bottom, 1))
            .OrderByDescending(group => group.Key);

        foreach (var group in groups)
        {
            var ordered = group.OrderBy(word => word.BoundingBox.Left).ToArray();
            if (ordered.Length == 0) continue;
            yield return string.Join(' ', ordered.Select(word => word.Text));
        }
    }
}
