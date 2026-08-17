namespace EntregaDeKits.Core;

public interface IRfidReaderClient : IAsyncDisposable
{
    string Name { get; }
    ReaderConnectionState State { get; }
    event EventHandler<ReaderConnectionState>? StateChanged;
    Task StartAsync(string address, IReadOnlyCollection<int> antennas, Func<TagRead, CancellationToken, Task> onRead, CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}

public interface IParticipantRepository
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
    Task<ImportReport> ReplaceParticipantsAsync(IEnumerable<Participant> participants, IReadOnlyList<string> issues, int blankRows, int invalidRows, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Participant>> FindByChipsAsync(IReadOnlyCollection<string> chips, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Participant>> SearchByNameAsync(string query, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Participant>> ListAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Participant>> ListDeliveredAsync(CancellationToken cancellationToken = default);
    Task ConfirmDeliveryAsync(long participantId, string epc, string operatorName, DateTimeOffset at, string? receiverName = null, CancellationToken cancellationToken = default);
}

public interface IChipIdentifierResolver
{
    IReadOnlyList<string> GetCandidates(string epc);
}
