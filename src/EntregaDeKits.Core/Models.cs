namespace EntregaDeKits.Core;

public sealed record Participant(
    long Id, string Number, string Chip, string Name, string? Cpf, string? BirthDate,
    string? Sex, string? Shirt, string? Modality, string? Category, DateTimeOffset? DeliveredAt = null, string? ReceiverName = null)
{
    public string PickupLabel => string.IsNullOrWhiteSpace(ReceiverName) ? "Retirado pelo titular" : "Retirado por " + ReceiverName;
    public string ListDetail => string.IsNullOrWhiteSpace(Modality) ? "Nº " + Number : "Nº " + Number + "  •  " + Modality;
    public string DeliveredDetail => "Nº " + Number + "  •  " + PickupLabel;
}

public sealed record DeliveryStats(int Total, int Delivered, int Remaining)
{
    public static DeliveryStats From(IReadOnlyCollection<Participant> roster)
    {
        var delivered = roster.Count(person => person.DeliveredAt is not null);
        return new(roster.Count, delivered, roster.Count - delivered);
    }

    public double Percent => Total == 0 ? 0 : Delivered * 100.0 / Total;
}

public sealed record TagRead(string Epc, DateTimeOffset Timestamp, int Antenna);

public enum ReaderConnectionState { Disconnected, Connecting, Connected, Reading, Error }

public enum DeliveryState { AwaitingConfirmation, AlreadyDelivered, NotDelivered, NotFound, Ambiguous }

public sealed record DeliveryResult(DeliveryState State, Participant? Participant, string Message, string Epc, DateTimeOffset OccurredAt);

/// <summary>
/// Resultado de uma importação. <see cref="DetectedFields"/> diz quais colunas
/// da planilha foram reconhecidas — é o que permite mostrar à operadora que a
/// associação das colunas aconteceu, em vez de ela ter que confiar no silêncio.
/// </summary>
public sealed record ImportReport(
    int Imported,
    int BlankRows,
    int InvalidRows,
    int DuplicateChips,
    IReadOnlyList<string> Issues,
    IReadOnlyList<string>? DetectedFields = null)
{
    public IReadOnlyList<string> Columns => DetectedFields ?? [];
}

/// <summary>Um campo do corredor pronto para o telão: rótulo e valor.</summary>
public sealed record DisplayField(string Label, string Value);

public sealed record DisplayModel(
    string State, string Name, string Number, string Chip, string Shirt,
    string Modality, string Category, string Detail, string BirthDate = "")
{
    /// <summary>
    /// Os campos que o telão deve mostrar, só os que a planilha realmente traz.
    ///
    /// Nem toda lista tem todas as colunas: uma prova sem categoria, outra sem
    /// camisa. Em vez de desenhar rótulos com travessão, o telão pergunta aqui
    /// o que existe e monta a grade em cima disso.
    ///
    /// O número de peito não entra: ele tem lugar próprio, em destaque.
    /// CPF nunca entra — o telão fica virado para o público.
    /// </summary>
    /// <summary>
    /// Instruções destinadas a quem opera o balcão. O telão é do público: não
    /// tem por que anunciar a um salão de corredores o que a operadora precisa
    /// clicar no notebook.
    /// </summary>
    private static readonly string[] RecadosDeOperacao =
    [
        "notebook",
        "confirme a entrega",
        "confirme a leitura"
    ];

    /// <summary>O recado que pode aparecer no telão, ou vazio.</summary>
    public string PublicDetail
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Detail)) return string.Empty;

            return RecadosDeOperacao.Any(termo => Detail.Contains(termo, StringComparison.OrdinalIgnoreCase))
                ? string.Empty
                : Detail.Trim();
        }
    }

    public IReadOnlyList<DisplayField> Fields =>
        new[]
        {
            new DisplayField("CHIP", Chip),
            new DisplayField("NASCIMENTO", BirthDate),
            new DisplayField("MODALIDADE", Modality),
            new DisplayField("CAMISA", Shirt),
            new DisplayField("CATEGORIA", Category)
        }
        .Where(field => !string.IsNullOrWhiteSpace(field.Value) && field.Value != "—")
        .ToArray();

    public static DisplayModel Idle { get; } = new("APROXIME O CHIP", "Aguardando corredor", "", "", "", "", "", "O telão mostra KIT ENTREGUE ou KIT NÃO ENTREGUE");
    public static DisplayModel From(DeliveryResult result)
    {
        if (result.Participant is null)
            return new(result.State == DeliveryState.Ambiguous ? "CHIP AMBÍGUO" : "CHIP NÃO LOCALIZADO", "Verifique a leitura", "", "", "", "", "", result.Message);

        var state = result.State switch
        {
            DeliveryState.AlreadyDelivered => "KIT ENTREGUE",
            DeliveryState.NotDelivered => "KIT NÃO ENTREGUE",
            DeliveryState.AwaitingConfirmation => "AGUARDANDO CONFIRMAÇÃO",
            _ => result.State.ToString().ToUpperInvariant()
        };
        return new(state, result.Participant.Name, result.Participant.Number, result.Participant.Chip,
            result.Participant.Shirt ?? string.Empty, result.Participant.Modality ?? string.Empty,
            result.Participant.Category ?? string.Empty, result.Message, result.Participant.BirthDate ?? string.Empty);
    }
}
