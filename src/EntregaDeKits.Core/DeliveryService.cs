namespace EntregaDeKits.Core;

public sealed class DeliveryService
{
    private readonly IParticipantRepository _repository;
    private readonly IChipIdentifierResolver _resolver;
    private readonly Dictionary<long, DeliveryResult> _pending = [];
    private readonly object _pendingLock = new();
    private readonly SemaphoreSlim _confirmationGate = new(1, 1);

    public DeliveryService(IParticipantRepository repository, IChipIdentifierResolver resolver)
    {
        _repository = repository;
        _resolver = resolver;
    }

    public IReadOnlyList<DeliveryResult> PendingQueue
    {
        get { lock (_pendingLock) return _pending.Values.OrderBy(item => item.OccurredAt).ToArray(); }
    }

    public void ClearPending() { lock (_pendingLock) _pending.Clear(); }

    public Task<IReadOnlyList<Participant>> SearchByNameAsync(string query, CancellationToken cancellationToken = default)
        => _repository.SearchByNameAsync(query, cancellationToken);

    public Task<IReadOnlyList<Participant>> ListRosterAsync(CancellationToken cancellationToken = default)
        => _repository.ListAllAsync(cancellationToken);

    public Task<IReadOnlyList<Participant>> ListDeliveredAsync(CancellationToken cancellationToken = default)
        => _repository.ListDeliveredAsync(cancellationToken);

    public DeliveryResult SelectForDelivery(Participant participant)
    {
        if (participant.DeliveredAt is not null)
            return new(DeliveryState.AlreadyDelivered, participant, $"Entregue às {participant.DeliveredAt.Value.LocalDateTime:HH:mm}.", participant.Chip, DateTimeOffset.Now);

        var token = string.IsNullOrWhiteSpace(participant.Chip) ? "BUSCA" : participant.Chip;
        var result = new DeliveryResult(DeliveryState.AwaitingConfirmation, participant, "Confirme a entrega do kit no notebook.", token, DateTimeOffset.Now);
        lock (_pendingLock) _pending[participant.Id] = result;
        return result;
    }

    public async Task<DeliveryResult> ProcessReadAsync(TagRead read, CancellationToken cancellationToken = default)
    {
        var matches = await _repository.FindByChipsAsync(_resolver.GetCandidates(read.Epc), cancellationToken);
        if (matches.Count == 0) return new(DeliveryState.NotFound, null, "Nenhum CHIP corresponde ao EPC lido.", read.Epc, read.Timestamp);
        if (matches.Count > 1) return new(DeliveryState.Ambiguous, null, "Mais de um inscrito corresponde ao EPC; confirme o cadastro.", read.Epc, read.Timestamp);

        var participant = matches[0];
        if (participant.DeliveredAt is not null)
            return new(DeliveryState.AlreadyDelivered, participant, $"Entregue às {participant.DeliveredAt.Value.LocalDateTime:HH:mm}.", read.Epc, read.Timestamp);

        return new(DeliveryState.NotDelivered, participant, "Este corredor ainda não retirou o kit.", read.Epc, read.Timestamp);
    }

    public async Task<DeliveryResult?> ConfirmAsync(long participantId, string operatorName, string? receiverName = null, CancellationToken cancellationToken = default)
    {
        await _confirmationGate.WaitAsync(cancellationToken);
        try
        {
            DeliveryResult? pending;
            lock (_pendingLock) _pending.TryGetValue(participantId, out pending);
            if (pending is null) return null;
            var receiver = ReceiverName.Normalize(receiverName);
            await _repository.ConfirmDeliveryAsync(participantId, pending.Epc, operatorName, DateTimeOffset.Now, receiver, cancellationToken);
            lock (_pendingLock) _pending.Remove(participantId);
            return pending with { Participant = pending.Participant is null ? null : pending.Participant with { ReceiverName = receiver } };
        }
        finally { _confirmationGate.Release(); }
    }
}
