using System.Threading.Channels;
using EntregaDeKits.Core;
using Impinj.OctaneSdk;

namespace EntregaDeKits.Infrastructure;

/// <summary>Cliente LLRP exclusivo para R420. O ShipRed precisa estar fechado antes da conexão.</summary>
public sealed class ImpinjR420Reader : IRfidReaderClient
{
    private static readonly TimeSpan StopTimeout = TimeSpan.FromSeconds(8);
    private readonly ImpinjReader _reader = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Channel<TagRead>? _channel;
    private CancellationTokenSource? _readingCts;
    private Task? _consumer;
    private string? _address;
    private int[] _antennas = [];
    private Task? _reconnect;
    public string Name => "Impinj Speedway R420";
    public ReaderConnectionState State { get; private set; } = ReaderConnectionState.Disconnected;
    public event EventHandler<ReaderConnectionState>? StateChanged;

    public ImpinjR420Reader() => _reader.ConnectionLost += OnConnectionLost;

    public async Task StartAsync(string address, IReadOnlyCollection<int> antennas, Func<TagRead, CancellationToken, Task> onRead, CancellationToken cancellationToken = default)
    {
        if (antennas.Count == 0 || antennas.Any(antenna => antenna is < 1 or > 4)) throw new ArgumentException("As antenas devem estar entre 1 e 4.", nameof(antennas));
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_consumer is not null) throw new InvalidOperationException("O R420 já está em leitura.");
            _address = address.Trim(); _antennas = antennas.Distinct().Order().ToArray();
            await ConnectAndConfigureAsync(cancellationToken);
            _readingCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _channel = Channel.CreateUnbounded<TagRead>();
            _consumer = ConsumeAsync(_channel.Reader, onRead, _readingCts.Token);
            _reader.TagsReported += OnTagsReported;
            await Task.Run(_reader.Start, cancellationToken);
            ChangeState(ReaderConnectionState.Reading);
        }
        catch
        {
            await CleanupAsync(); Disconnect(); ChangeState(ReaderConnectionState.Error); throw;
        }
        finally { _gate.Release(); }
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        _readingCts?.Cancel();
        try { if (_reconnect is not null) await _reconnect.WaitAsync(StopTimeout, cancellationToken); } catch (TimeoutException) { Disconnect(); } catch (OperationCanceledException) { }
        if (!await _gate.WaitAsync(StopTimeout, cancellationToken)) { Disconnect(); throw new TimeoutException("O R420 não liberou a operação no tempo esperado."); }
        try
        {
            if (_reader.IsConnected && _consumer is not null) await Task.Run(_reader.Stop, cancellationToken).WaitAsync(StopTimeout, cancellationToken);
        }
        catch { Disconnect(); }
        finally { await CleanupAsync(); ChangeState(_reader.IsConnected ? ReaderConnectionState.Connected : ReaderConnectionState.Disconnected); _gate.Release(); }
    }

    private async Task ConnectAndConfigureAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_address)) throw new InvalidOperationException("IP do R420 não informado.");
        if (!_reader.IsConnected)
        {
            ChangeState(ReaderConnectionState.Connecting);
            var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            void Completed(ImpinjReader reader, ConnectAsyncResult result, string error)
            {
                if (result == ConnectAsyncResult.Success) completion.TrySetResult();
                else completion.TrySetException(new InvalidOperationException(error));
            }
            _reader.ConnectAsyncComplete += Completed;
            try { _reader.ConnectAsync(_address); await completion.Task.WaitAsync(TimeSpan.FromSeconds(12), cancellationToken); }
            finally { _reader.ConnectAsyncComplete -= Completed; }
        }
        await Task.Run(() =>
        {
            var settings = _reader.QueryDefaultSettings();
            settings.AutoStart.Mode = AutoStartMode.None; settings.AutoStop.Mode = AutoStopMode.None;
            settings.Report.IncludeAntennaPortNumber = true; settings.Report.Mode = ReportMode.Individual;
            settings.Keepalives.Enabled = true; settings.Keepalives.PeriodInMs = 2000; settings.Keepalives.EnableLinkMonitorMode = true; settings.Keepalives.LinkDownThreshold = 3;
            settings.Antennas.DisableAll(); foreach (var antenna in _antennas) settings.Antennas.GetAntenna((ushort)antenna).IsEnabled = true;
            _reader.ApplySettings(settings);
        }, cancellationToken);
    }

    private void OnTagsReported(ImpinjReader reader, TagReport report)
    {
        foreach (var tag in report.Tags)
            if (tag.AntennaPortNumber is >= 1 and <= 4) _channel?.Writer.TryWrite(new TagRead(tag.Epc.ToString(), DateTimeOffset.Now, tag.AntennaPortNumber));
    }

    private void OnConnectionLost(ImpinjReader reader)
    {
        if (_readingCts?.IsCancellationRequested != false || string.IsNullOrWhiteSpace(_address)) { ChangeState(ReaderConnectionState.Disconnected); return; }
        if (_reconnect is null || _reconnect.IsCompleted) _reconnect = ReconnectAsync(_readingCts.Token);
    }

    private async Task ReconnectAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 1; !cancellationToken.IsCancellationRequested; attempt++)
        {
            try
            {
                ChangeState(ReaderConnectionState.Connecting); await _gate.WaitAsync(cancellationToken);
                try { Disconnect(); await ConnectAndConfigureAsync(cancellationToken); await Task.Run(_reader.Start, cancellationToken); ChangeState(ReaderConnectionState.Reading); return; }
                finally { _gate.Release(); }
            }
            catch (OperationCanceledException) { return; }
            catch { ChangeState(ReaderConnectionState.Error); await Task.Delay(TimeSpan.FromSeconds(Math.Min(15, Math.Pow(2, Math.Min(attempt, 4)))), cancellationToken); }
        }
    }

    private static async Task ConsumeAsync(ChannelReader<TagRead> reader, Func<TagRead, CancellationToken, Task> callback, CancellationToken cancellationToken)
    { await foreach (var read in reader.ReadAllAsync(cancellationToken)) await callback(read, cancellationToken); }

    private async Task CleanupAsync()
    {
        _reader.TagsReported -= OnTagsReported; _channel?.Writer.TryComplete();
        if (_readingCts is not null) { _readingCts.Cancel(); try { if (_consumer is not null) await _consumer; } catch (OperationCanceledException) { } _readingCts.Dispose(); }
        _channel = null; _consumer = null; _readingCts = null; _reconnect = null;
    }
    private void Disconnect() { try { if (_reader.IsConnected) _reader.Disconnect(); } catch { } }
    private void ChangeState(ReaderConnectionState state) { State = state; StateChanged?.Invoke(this, state); }
    public async ValueTask DisposeAsync() { await StopAsync(); _reader.ConnectionLost -= OnConnectionLost; _gate.Dispose(); }
}
