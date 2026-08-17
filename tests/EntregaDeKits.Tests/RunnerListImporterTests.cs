using System.Text;
using EntregaDeKits.Core;
using EntregaDeKits.Infrastructure;

namespace EntregaDeKits.Tests;

public sealed class RunnerListImporterTests
{
    [Fact]
    public void Imports_semicolon_text_without_chip()
    {
        var path = WriteTemp(".txt", "Numero;Nome;Camisa;Modalidade\n21;José da Silva;M;10K\n");
        try
        {
            var result = new RunnerListImporter().Read(path);
            var person = Assert.Single(result.Participants);
            Assert.Equal("21", person.Number);
            Assert.Equal("José da Silva", person.Name);
            Assert.Equal("21", person.Chip);
            Assert.Equal("M", person.Shirt);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Imports_xml_records_and_blocks_xxe()
    {
        var path = WriteTemp(".xml", """
            <inscritos>
              <inscrito>
                <nome>Ana Souza</nome>
                <numero>8</numero>
                <chip>AAA8</chip>
                <cpf>123</cpf>
                <categoria>Geral</categoria>
              </inscrito>
            </inscritos>
            """);
        try
        {
            var result = new RunnerListImporter().Read(path);
            var person = Assert.Single(result.Participants);
            Assert.Equal("Ana Souza", person.Name);
            Assert.Equal("8", person.Number);
            Assert.Equal("AAA8", person.Chip);
            Assert.Equal("123", person.Cpf);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Imports_pdf_table_as_semicolon_lines()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".pdf");
        File.WriteAllBytes(path, MinimalPdf("NUM;Inscrito;CHIP", "33;Pedro Lima;CHIP33"));
        try
        {
            var result = new RunnerListImporter().Read(path);
            var person = Assert.Single(result.Participants);
            Assert.Equal("33", person.Number);
            Assert.Equal("Pedro Lima", person.Name);
            Assert.Equal("CHIP33", person.Chip);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Rejects_unknown_extension()
    {
        var path = WriteTemp(".exe", "nao");
        try
        {
            Assert.Throws<InvalidDataException>(() => new RunnerListImporter().Read(path));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Pages_ten_runners_then_the_remainder()
    {
        var items = Enumerable.Range(1, 25).ToArray();
        Assert.Equal(3, RosterPager.PageCount(items.Length));
        Assert.Equal(10, RosterPager.TakePage(items, 1).Count);
        Assert.Equal([21, 22, 23, 24, 25], RosterPager.TakePage(items, 3));
        Assert.Equal(1, RosterPager.ClampPage(0, items.Length));
    }

    [Fact]
    public void Folds_accented_names_for_search()
    {
        Assert.True(NameSearch.Matches("José da Silva", "21", "jose"));
        Assert.True(NameSearch.Matches("José da Silva", "21", "j"));
        Assert.False(NameSearch.Matches("José da Silva", "21", "maria"));
    }

    private static string WriteTemp(string extension, string content)
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + extension);
        File.WriteAllText(path, content, new UTF8Encoding(false));
        return path;
    }

    private static byte[] MinimalPdf(string header, string row)
    {
        var stream = $"BT /F1 12 Tf 40 140 Td ({header}) Tj 0 -18 Td ({row}) Tj ET";
        var content = $"<< /Length {stream.Length} >> stream\n{stream}\nendstream\n";
        var builder = new StringBuilder();
        builder.Append("%PDF-1.4\n");
        var offsets = new List<int>();
        void Obj(string body)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
            builder.Append(body);
        }
        Obj("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
        Obj("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
        Obj("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n");
        Obj($"4 0 obj {content}endobj\n");
        Obj("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");
        var xref = Encoding.ASCII.GetByteCount(builder.ToString());
        builder.Append($"xref\n0 6\n0000000000 65535 f \n");
        foreach (var offset in offsets) builder.Append(offset.ToString("D10") + " 00000 n \n");
        builder.Append($"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return Encoding.ASCII.GetBytes(builder.ToString());
    }
}
