using Microsoft.Data.Sqlite;

namespace EntregaDeKits.Infrastructure;

internal static class SqliteMigrations
{
    private const long CurrentVersion = 3;

    public static async Task ApplyAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var version = await GetVersionAsync(connection, cancellationToken);
        if (version > CurrentVersion) throw new InvalidOperationException($"A base local usa versão {version}, superior à suportada ({CurrentVersion}).");
        if (version == CurrentVersion) return;

        await using var transaction = connection.BeginTransaction();
        if (version < 1)
        {
            var create = connection.CreateCommand();
            create.Transaction = transaction;
            create.CommandText = """
                CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY, number TEXT NOT NULL, chip TEXT NOT NULL, name TEXT NOT NULL, cpf TEXT, birth_date TEXT, sex TEXT, shirt TEXT, modality TEXT, category TEXT, delivered_at TEXT);
                CREATE INDEX IF NOT EXISTS ix_participants_chip ON participants(chip);
                CREATE TABLE IF NOT EXISTS delivery_audit (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL, epc TEXT NOT NULL, operator_name TEXT NOT NULL, delivered_at TEXT NOT NULL, FOREIGN KEY(participant_id) REFERENCES participants(id));
                PRAGMA user_version = 1;
                """;
            await create.ExecuteNonQueryAsync(cancellationToken);
            version = 1;
        }

        if (version < 2)
        {
            var fold = connection.CreateCommand();
            fold.Transaction = transaction;
            fold.CommandText = """
                ALTER TABLE participants ADD COLUMN name_folded TEXT;
                CREATE INDEX IF NOT EXISTS ix_participants_name_folded ON participants(name_folded);
                CREATE INDEX IF NOT EXISTS ix_participants_name ON participants(name);
                PRAGMA user_version = 2;
                """;
            await fold.ExecuteNonQueryAsync(cancellationToken);
            version = 2;
        }

        if (version < 3)
        {
            await AddColumnIfMissingAsync(connection, transaction, "participants", "receiver_name", "TEXT", cancellationToken);
            await AddColumnIfMissingAsync(connection, transaction, "delivery_audit", "receiver_name", "TEXT", cancellationToken);
            var pragma = connection.CreateCommand();
            pragma.Transaction = transaction;
            pragma.CommandText = "PRAGMA user_version = 3;";
            await pragma.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task AddColumnIfMissingAsync(SqliteConnection connection, SqliteTransaction transaction, string table, string column, string type, CancellationToken cancellationToken)
    {
        var info = connection.CreateCommand();
        info.Transaction = transaction;
        info.CommandText = $"PRAGMA table_info({table});";
        await using var reader = await info.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase)) return;
        }

        var alter = connection.CreateCommand();
        alter.Transaction = transaction;
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {type};";
        await alter.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<long> GetVersionAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand(); command.CommandText = "PRAGMA user_version;";
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken), System.Globalization.CultureInfo.InvariantCulture);
    }
}
