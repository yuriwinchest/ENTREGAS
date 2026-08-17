using EntregaDeKits.Core;
using EntregaDeKits.Infrastructure;
using Microsoft.Data.Sqlite;

namespace EntregaDeKits.Tests;

public sealed class SqliteParticipantRepositoryTests
{
    [Fact]
    public async Task Applies_versioned_migration_idempotently_without_losing_data()
    {
        var directory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var database = Path.Combine(directory, "event.db");
        try
        {
            var repository = new SqliteParticipantRepository(database); await repository.InitializeAsync();
            await repository.ReplaceParticipantsAsync([new Participant(0, "1", "A", "Pessoa", null, null, null, null, null, null)], [], 0, 0);
            await repository.InitializeAsync();
            await using var connection = new SqliteConnection($"Data Source={database}"); await connection.OpenAsync();
            var version = connection.CreateCommand(); version.CommandText = "PRAGMA user_version;";
            Assert.Equal(3L, Convert.ToInt64(await version.ExecuteScalarAsync()));
            Assert.Single(await repository.FindByChipsAsync(["A"]));
        }
        finally { SqliteConnection.ClearAllPools(); if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }

    [Fact]
    public async Task Persists_confirmed_delivery_across_repository_instances()
    {
        var directory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var database = Path.Combine(directory, "event.db");
        try
        {
            var repository = new SqliteParticipantRepository(database); await repository.InitializeAsync();
            await repository.ReplaceParticipantsAsync([new Participant(0, "7", "0007", "Pessoa", null, null, null, "P", "5K", "Geral")], [], 0, 0);
            var participant = Assert.Single(await repository.FindByChipsAsync(["0007"]));
            await repository.ConfirmDeliveryAsync(participant.Id, "0007", "Operador", DateTimeOffset.Parse("2026-08-03T10:00:00-03:00"));
            var reopened = new SqliteParticipantRepository(database); await reopened.InitializeAsync();
            Assert.NotNull(Assert.Single(await reopened.FindByChipsAsync(["0007"])).DeliveredAt);
            var byName = Assert.Single(await reopened.SearchByNameAsync("pessoa"));
            Assert.Equal("7", byName.Number);
            Assert.Single(await reopened.ListAllAsync());
            Assert.Single(await reopened.ListDeliveredAsync());
        }
        finally { SqliteConnection.ClearAllPools(); if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
}
