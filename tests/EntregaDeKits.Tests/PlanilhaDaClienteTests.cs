using EntregaDeKits.Infrastructure;

namespace EntregaDeKits.Tests;

/// <summary>
/// A planilha que a cliente usou no teste real. Ela traz "NUMERO", "NOME" e
/// "NASCIMENTO" — e não "NUM", "Inscrito", "Data de Nascimento" — e não tem
/// coluna de CPF nem de categoria. O importador antigo recusava o arquivo
/// inteiro por causa disso.
/// </summary>
public sealed class PlanilhaDaClienteTests
{
    private static string Caminho()
    {
        var raiz = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        return Path.Combine(raiz, "PLANILHA TESTE CONFERE CHIP.xlsx");
    }

    [Fact]
    public void CabecalhoDaClienteEAceito()
    {
        var resultado = new ExcelParticipantImporter().Read(Caminho());

        Assert.NotEmpty(resultado.Participants);
        var primeiro = resultado.Participants[0];
        Assert.Equal("1", primeiro.Number);
        Assert.Equal("900076", primeiro.Chip);
        Assert.Equal("ALINE PEDROSA", primeiro.Name);
        Assert.Equal("F", primeiro.Sex);
        Assert.Equal("5KM", primeiro.Modality);
        Assert.Equal("P", primeiro.Shirt);
    }

    [Fact]
    public void ColunasQueAPlanilhaNaoTemNaoImpedemAImportacao()
    {
        // Não há CPF nem categoria neste arquivo, e isso não é motivo para
        // recusar a lista: o que importa é nome mais número ou chip.
        var resultado = new ExcelParticipantImporter().Read(Caminho());

        Assert.All(resultado.Participants, pessoa =>
        {
            Assert.False(string.IsNullOrWhiteSpace(pessoa.Name));
            Assert.False(string.IsNullOrWhiteSpace(pessoa.Chip));
        });
    }

    [Fact]
    public void PlanilhaAbertaNoExcelAindaPodeSerAnexada()
    {
        // Reproduz o erro relatado: "the process cannot access the file because
        // it is being used by another process". Quem acabou de conferir a
        // planilha no Excel e vai anexá-la em seguida caía exatamente aqui.
        using var travaDoExcel = new FileStream(
            Caminho(), FileMode.Open, FileAccess.ReadWrite, FileShare.Read);

        var resultado = new ExcelParticipantImporter().Read(Caminho());

        Assert.NotEmpty(resultado.Participants);
    }

    [Fact]
    public void ChipDaClienteEEncontradoPelaBuscaDoBalcao()
    {
        var resultado = new ExcelParticipantImporter().Read(Caminho());
        var aline = resultado.Participants.First(pessoa => pessoa.Chip == "900076");

        Assert.True(EntregaDeKits.Core.NameSearch.Matches(aline.Name, aline.Number, aline.Chip, "900076"));
        Assert.True(EntregaDeKits.Core.NameSearch.IsIdentifierOf(aline.Number, aline.Chip, "900076"));
    }

    [Fact]
    public void ChipsDaPlanilhaNaoColidemEntreSi()
    {
        // Chip repetido entre corredores é descartado na hora da leitura, então
        // vale conferir que esta lista não tem esse problema.
        var resultado = new ExcelParticipantImporter().Read(Caminho());
        var chips = resultado.Participants.Select(pessoa => pessoa.Chip).ToArray();

        Assert.Equal(chips.Length, chips.Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }
}
