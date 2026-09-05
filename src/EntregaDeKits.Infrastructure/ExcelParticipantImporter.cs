using ClosedXML.Excel;
using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

/// <summary>
/// Lê a planilha do evento.
///
/// DOIS DEFEITOS QUE ESTA CLASSE JÁ TEVE, e por que a forma atual é assim:
///
/// 1. EXIGIA CABEÇALHOS LITERAIS. A lista aceita era fixa — "NUM", "Inscrito",
///    "Data de Nascimento", "CPF", "Categoria" — e qualquer planilha que
///    escrevesse "NUMERO", "NOME" ou "NASCIMENTO" era recusada inteira, mesmo
///    trazendo todas as informações necessárias. Pior: o Excel era o ÚNICO
///    formato assim. TXT, CSV, XML e PDF já passavam pelo mapa de sinônimos do
///    <see cref="ParticipantFieldMap"/>, que reconhece essas variações. Agora
///    todos os formatos entram pelo mesmo caminho, e o que vale para um vale
///    para os outros.
///
/// 2. ABRIA O ARQUIVO COM EXCLUSIVIDADE. Quem acabou de conferir a planilha no
///    Excel e vai anexá-la — que é o caminho natural — recebia "the process
///    cannot access the file because it is being used by another process". O
///    Excel mantém o arquivo aberto. Abrir com <see cref="FileShare.ReadWrite"/>
///    resolve: aqui só se lê, então conviver com o Excel é seguro.
/// </summary>
public sealed class ExcelParticipantImporter
{
    public (IReadOnlyList<Participant> Participants, ImportReport Report) Read(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var workbook = new XLWorkbook(stream);

        var sheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new InvalidDataException("A planilha não possui nenhuma aba.");

        var rows = LerLinhas(sheet);
        if (rows.Count == 0) throw new InvalidDataException("A planilha não possui linhas preenchidas.");

        return TabularParticipantParser.Parse(rows);
    }

    private static List<IReadOnlyList<string>> LerLinhas(IXLWorksheet sheet)
    {
        var rows = new List<IReadOnlyList<string>>();

        foreach (var row in sheet.RowsUsed())
        {
            var ultimaColuna = row.LastCellUsed()?.Address.ColumnNumber ?? 0;
            if (ultimaColuna == 0) continue;

            var celulas = new string[ultimaColuna];
            for (var coluna = 1; coluna <= ultimaColuna; coluna++)
            {
                // GetFormattedString respeita o formato da célula: uma data
                // guardada como número serial sai como data, e o CHIP guardado
                // como texto não vira notação científica.
                celulas[coluna - 1] = row.Cell(coluna).GetFormattedString().Trim();
            }

            rows.Add(celulas);
        }

        return rows;
    }
}
