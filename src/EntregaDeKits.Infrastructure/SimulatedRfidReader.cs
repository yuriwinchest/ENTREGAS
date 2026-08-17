using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

public sealed class SimulatedRfidReader : IRfidReaderClient
{
    private Func<TagRead, CancellationToken, Task>? _onRead;
    public string Name => "Simulador RFID";
    public ReaderConnectionState State { get; private set; } = ReaderConnectionState.Disconnected;
    public event EventHandler<ReaderConnectionState>? StateChanged;

    public Task StartAsync(string address, IReadOnlyCollection<int> antennas, Func<TagRead, CancellationToken, Task> onRead, CancellationToken cancellationToken = default)
    {
        if (antennas.Count == 0) throw new ArgumentException("Selecione ao menos uma antena.", nameof(antennas));
        _onRead = onRead; ChangeState(ReaderConnectionState.Reading); return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken = default) { _onRead = null; ChangeState(ReaderConnectionState.Disconnected); return Task.CompletedTask; }
    public Task SimulateAsync(string epc, int antenna = 1, CancellationToken cancellationToken = default) => _onRead?.Invoke(new TagRead(epc, DateTimeOffset.Now, antenna), cancellationToken) ?? Task.CompletedTask;
    public async ValueTask DisposeAsync() => await StopAsync();
    private void ChangeState(ReaderConnectionState state) { State = state; StateChanged?.Invoke(this, state); }
}
