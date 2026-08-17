using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

public sealed class DeliveryServiceTests
{
    [Fact]
    public async Task Reader_reports_not_delivered_without_queuing()
    {
        var repository = new MemoryRepository(new Participant(1, "21", "51921", "Aline Teste", null, null, null, "M", "5K", "Geral"));
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        var read = await service.ProcessReadAsync(new TagRead("00000000000000000000CAD1", DateTimeOffset.Now, 1));
        Assert.Equal(DeliveryState.NotDelivered, read.State);
        Assert.Empty(service.PendingQueue);
        Assert.Equal("KIT NÃO ENTREGUE", DisplayModel.From(read).State);
    }

    [Fact]
    public async Task Desk_confirms_and_reader_then_reports_delivered()
    {
        var repository = new MemoryRepository(new Participant(1, "21", "51921", "Aline Teste", null, null, null, "M", "5K", "Geral"));
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        service.SelectForDelivery((await service.SearchByNameAsync("aline")).Single());
        await service.ConfirmAsync(1, "Operador");
        Assert.NotNull(repository.Audit);
        var again = await service.ProcessReadAsync(new TagRead("00000000000000000000CAD1", DateTimeOffset.Now, 1));
        Assert.Equal(DeliveryState.AlreadyDelivered, again.State);
        Assert.Equal("KIT ENTREGUE", DisplayModel.From(again).State);
        Assert.Single(await service.ListDeliveredAsync());
    }

    [Fact]
    public async Task Rejects_duplicate_chip_as_ambiguous()
    {
        var repository = new MemoryRepository(new Participant(1, "1", "X", "Um", null, null, null, null, null, null), new Participant(2, "2", "X", "Dois", null, null, null, null, null, null));
        var result = await new DeliveryService(repository, new ChipIdentifierResolver()).ProcessReadAsync(new TagRead("X", DateTimeOffset.Now, 1));
        Assert.Equal(DeliveryState.Ambiguous, result.State);
    }

    [Fact]
    public async Task Preserves_pending_item_when_persistence_fails()
    {
        var repository = new MemoryRepository(new Participant(1, "1", "X", "Um", null, null, null, null, null, null)) { ThrowOnConfirm = true };
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        service.SelectForDelivery((await service.SearchByNameAsync("Um")).Single());
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ConfirmAsync(1, "Operador"));
        Assert.Single(service.PendingQueue);
    }

    [Fact]
    public void List_labels_are_plain_readable_text()
    {
        var person = new Participant(1, "21", "C", "Ana Souza", null, null, null, "M", "10K", "Geral", DateTimeOffset.Now, "Maria");
        Assert.Equal("Nº 21  •  10K", person.ListDetail);
        Assert.Equal("Nº 21  •  Retirado por Maria", person.DeliveredDetail);
    }

    [Fact]
    public void Progress_board_counts_delivered_against_the_full_roster()
    {
        var stats = DeliveryStats.From([
            new Participant(1, "1", "A", "Um", null, null, null, null, null, null, DateTimeOffset.Now),
            new Participant(2, "2", "B", "Dois", null, null, null, null, null, null)
        ]);
        Assert.Equal(2, stats.Total);
        Assert.Equal(1, stats.Delivered);
        Assert.Equal(1, stats.Remaining);
        Assert.Equal(50, stats.Percent);
    }

    [Fact]
    public async Task Third_party_pickup_requires_a_real_name_and_is_audited()
    {
        var repository = new MemoryRepository(new Participant(3, "8", "C8", "Ana Souza", null, null, null, "P", "5K", "Geral"));
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        service.SelectForDelivery((await service.SearchByNameAsync("ana")).Single());
        Assert.Null(ReceiverName.Normalize("12"));
        var confirmed = await service.ConfirmAsync(3, "Operador", "Maria Oliveira");
        Assert.Equal("Maria Oliveira", confirmed!.Participant!.ReceiverName);
        Assert.Contains("Maria Oliveira", repository.Audit, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Search_by_name_selects_runner_for_delivery()
    {
        var repository = new MemoryRepository(new Participant(9, "44", "CHIP44", "José da Silva", "000", "01/01/1990", "M", "G", "10K", "30-39"));
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        var found = Assert.Single(await service.SearchByNameAsync("jose"));
        var selected = service.SelectForDelivery(found);
        Assert.Equal(DeliveryState.AwaitingConfirmation, selected.State);
        Assert.Equal("44", selected.Participant!.Number);
        await service.ConfirmAsync(9, "Operador");
        var again = service.SelectForDelivery((await service.SearchByNameAsync("44")).Single());
        Assert.Equal(DeliveryState.AlreadyDelivered, again.State);
    }

    [Fact]
    public async Task Clears_all_pending_items()
    {
        var repository = new MemoryRepository(new Participant(1, "1", "A", "Um", null, null, null, null, null, null), new Participant(2, "2", "B", "Dois", null, null, null, null, null, null));
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        service.SelectForDelivery((await service.SearchByNameAsync("Um")).Single());
        service.SelectForDelivery((await service.SearchByNameAsync("Dois")).Single());
        service.ClearPending();
        Assert.Empty(service.PendingQueue);
    }

    [Fact]
    public async Task Concurrent_reread_and_snapshots_do_not_leave_stale_pending_item_after_confirmation()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var repository = new MemoryRepository(new Participant(1, "1", "X", "Um", null, null, null, null, null, null)) { ConfirmationStarted = started, ConfirmationBarrier = release };
        var service = new DeliveryService(repository, new ChipIdentifierResolver());
        service.SelectForDelivery((await service.SearchByNameAsync("Um")).Single());
        var confirmation = service.ConfirmAsync(1, "Operador");
        await started.Task;
        var reads = Enumerable.Range(0, 32).Select(_ => Task.Run(() => service.ProcessReadAsync(new TagRead("X", DateTimeOffset.Now, 1))));
        var snapshots = Enumerable.Range(0, 32).Select(_ => Task.Run(() => service.PendingQueue.Count));
        await Task.WhenAll(reads.Select(task => (Task)task).Concat(snapshots.Select(task => (Task)task)));
        release.SetResult();
        await confirmation;
        Assert.Empty(service.PendingQueue);
    }

    private sealed class MemoryRepository(params Participant[] participants) : IParticipantRepository
    {
        private readonly List<Participant> _participants = participants.ToList(); public string? Audit { get; private set; }
        public bool ThrowOnConfirm { get; init; }
        public TaskCompletionSource? ConfirmationStarted { get; init; }
        public TaskCompletionSource? ConfirmationBarrier { get; init; }
        public Task InitializeAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<ImportReport> ReplaceParticipantsAsync(IEnumerable<Participant> values, IReadOnlyList<string> issues, int blankRows, int invalidRows, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<Participant>> FindByChipsAsync(IReadOnlyCollection<string> chips, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Participant>>(_participants.Where(person => chips.Contains(person.Chip, StringComparer.OrdinalIgnoreCase)).ToArray());
        public Task<IReadOnlyList<Participant>> SearchByNameAsync(string query, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Participant>>(string.IsNullOrWhiteSpace(query) ? _participants.ToArray() : _participants.Where(person => NameSearch.Matches(person.Name, person.Number, query)).ToArray());
        public Task<IReadOnlyList<Participant>> ListAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Participant>>(_participants.ToArray());
        public Task<IReadOnlyList<Participant>> ListDeliveredAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Participant>>(_participants.Where(person => person.DeliveredAt is not null).ToArray());
        public async Task ConfirmDeliveryAsync(long participantId, string epc, string operatorName, DateTimeOffset at, string? receiverName = null, CancellationToken cancellationToken = default) { if (ThrowOnConfirm) throw new InvalidOperationException("Falha de persistência simulada."); ConfirmationStarted?.TrySetResult(); if (ConfirmationBarrier is not null) await ConfirmationBarrier.Task; var index = _participants.FindIndex(person => person.Id == participantId); _participants[index] = _participants[index] with { DeliveredAt = at, ReceiverName = receiverName }; Audit = epc + operatorName + (receiverName ?? ""); }
    }
}
