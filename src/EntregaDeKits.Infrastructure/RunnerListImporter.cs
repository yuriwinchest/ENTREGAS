using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

public sealed class RunnerListImporter
{
    public const long MaxBytes = 20 * 1024 * 1024;

    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".csv", ".xml", ".pdf", ".xlsx"
    };

    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            throw new FileNotFoundException("O arquivo da lista não foi encontrado.", path);

        var extension = Path.GetExtension(path);
        if (!Allowed.Contains(extension))
            throw new InvalidDataException("Anexe um arquivo .txt, .csv, .xml, .pdf ou .xlsx.");

        var length = new FileInfo(path).Length;
        if (length <= 0) throw new InvalidDataException("O arquivo está vazio.");
        if (length > MaxBytes) throw new InvalidDataException("O arquivo excede o limite de 20 MB.");

        return extension.ToLowerInvariant() switch
        {
            ".xlsx" => new ExcelParticipantImporter().Read(path),
            ".xml" => new XmlParticipantImporter().Read(path),
            ".pdf" => new PdfParticipantImporter().Read(path),
            _ => new TextParticipantImporter().Read(path)
        };
    }
}
