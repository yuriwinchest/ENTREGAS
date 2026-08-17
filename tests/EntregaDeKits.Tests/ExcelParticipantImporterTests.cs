using ClosedXML.Excel;
using EntregaDeKits.Infrastructure;

namespace EntregaDeKits.Tests;

public sealed class ExcelParticipantImporterTests
{
    [Fact]
    public void Imports_the_reference_workbook_from_the_project_root()
    {
        var projectRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var workbookPath = Path.Combine(projectRoot, "LISTA INSCRITOS DE POSTO EM POSTO CORRETA.xlsx");

        var result = new ExcelParticipantImporter().Read(workbookPath);

        Assert.Equal(857, result.Participants.Count);
        Assert.Equal(8, result.Report.InvalidRows);
        Assert.Equal(0, result.Report.DuplicateChips);
        Assert.Equal("51921", result.Participants[0].Chip);
        Assert.False(string.IsNullOrWhiteSpace(result.Participants[0].Cpf));
        Assert.False(string.IsNullOrWhiteSpace(result.Participants[0].Shirt));
        Assert.False(string.IsNullOrWhiteSpace(result.Participants[0].Modality));
    }

    [Fact]
    public void Preserves_chip_as_text_and_reports_duplicate()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".xlsx");
        try
        {
            using (var book = new XLWorkbook())
            {
                var sheet = book.AddWorksheet("Inscritos");
                var columns = new[] { "NUM", "CHIP", "Inscrito", "CPF", "Data de Nascimento", "SEXO", "Camisa", "Modalidade", "Categoria" };
                for (var index = 0; index < columns.Length; index++) sheet.Cell(1, index + 1).Value = columns[index];
                sheet.Cell(2, 1).Value = "1"; sheet.Cell(2, 2).Value = "0007"; sheet.Cell(2, 3).Value = "Pessoa A";
                sheet.Cell(3, 1).Value = "2"; sheet.Cell(3, 2).Value = "0007"; sheet.Cell(3, 3).Value = "Pessoa B";
                book.SaveAs(path);
            }
            var result = new ExcelParticipantImporter().Read(path);
            Assert.Equal("0007", result.Participants[0].Chip); Assert.Equal(1, result.Report.DuplicateChips);
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }
}
