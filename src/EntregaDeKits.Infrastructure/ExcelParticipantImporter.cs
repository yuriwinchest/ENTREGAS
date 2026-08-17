using ClosedXML.Excel;
using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

public sealed class ExcelParticipantImporter
{
    private static readonly string[] RequiredHeaders = ["NUM", "CHIP", "Inscrito", "CPF", "Data de Nascimento", "SEXO", "Camisa", "Modalidade", "Categoria"];

    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        using var workbook = new XLWorkbook(path);
        var sheet = workbook.Worksheets.First();
        var header = sheet.FirstRowUsed();
        if (header is null) throw new InvalidDataException("A planilha não possui cabeçalho.");
        var columns = header.CellsUsed().ToDictionary(cell => cell.GetString().Trim(), cell => cell.Address.ColumnNumber, StringComparer.OrdinalIgnoreCase);
        var missing = RequiredHeaders.Where(name => !columns.ContainsKey(name)).ToArray();
        if (missing.Length > 0) throw new InvalidDataException($"Colunas obrigatórias ausentes: {string.Join(", ", missing)}.");

        var people = new List<Participant>();
        var issues = new List<string>();
        var seenChips = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var blanks = 0; var invalid = 0; var duplicates = 0;
        foreach (var row in sheet.RowsUsed().Skip(1))
        {
            string Text(string name) => row.Cell(columns[name]).GetFormattedString().Trim();
            var number = Text("NUM"); var chip = Text("CHIP"); var name = Text("Inscrito");
            if (string.IsNullOrWhiteSpace(number) && string.IsNullOrWhiteSpace(chip) && string.IsNullOrWhiteSpace(name)) { blanks++; continue; }
            if (string.IsNullOrWhiteSpace(number) || string.IsNullOrWhiteSpace(chip) || string.IsNullOrWhiteSpace(name)) { invalid++; issues.Add($"Linha {row.RowNumber()}: NUM, CHIP e Inscrito são obrigatórios."); continue; }
            chip = ChipIdentifierResolver.Normalize(chip);
            if (!seenChips.Add(chip)) { duplicates++; issues.Add($"Linha {row.RowNumber()}: CHIP duplicado '{chip}'."); }
            people.Add(new Participant(0, number, chip, name, Text("CPF"), Text("Data de Nascimento"), Text("SEXO"), Text("Camisa"), Text("Modalidade"), Text("Categoria")));
        }
        return (people, new ImportReport(people.Count, blanks, invalid, duplicates, issues));
    }
}
