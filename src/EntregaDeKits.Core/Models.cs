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

public sealed record ImportReport(int Imported, int BlankRows, int InvalidRows, int DuplicateChips, IReadOnlyList<string> Issues);

public sealed record DisplayModel(string State, string Name, string Number, string Chip, string Shirt, string Modality, string Category, string Detail)
{
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
        return new(state, result.Participant.Name, result.Participant.Number, result.Participant.Chip, result.Participant.Shirt ?? "—", result.Participant.Modality ?? "—", result.Participant.Category ?? "—", result.Message);
    }
}
