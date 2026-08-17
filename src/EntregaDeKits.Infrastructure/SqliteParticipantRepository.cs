using EntregaDeKits.Core;
using Microsoft.Data.Sqlite;

namespace EntregaDeKits.Infrastructure;

public sealed class SqliteParticipantRepository : IParticipantRepository
{
    private readonly string _connectionString;
    public SqliteParticipantRepository(string databasePath) => _connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath, ForeignKeys = true }.ToString();

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(new SqliteConnectionStringBuilder(_connectionString).DataSource)!);
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        await SqliteMigrations.ApplyAsync(connection, cancellationToken);
        await BackfillFoldedNamesAsync(connection, cancellationToken);
    }

    private static async Task BackfillFoldedNamesAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var select = connection.CreateCommand();
        select.CommandText = "SELECT id, name FROM participants WHERE name_folded IS NULL OR name_folded = ''";
        var pending = new List<(long Id, string Name)>();
        await using (var reader = await select.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken)) pending.Add((reader.GetInt64(0), reader.GetString(1)));
        }

        foreach (var (id, name) in pending)
        {
            var update = connection.CreateCommand();
            update.CommandText = "UPDATE participants SET name_folded=$folded WHERE id=$id";
            update.Parameters.AddWithValue("$folded", NameSearch.Fold(name));
            update.Parameters.AddWithValue("$id", id);
            await update.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    public async Task<ImportReport> ReplaceParticipantsAsync(IEnumerable<Participant> participants, IReadOnlyList<string> issues, int blankRows, int invalidRows, CancellationToken cancellationToken = default)
    {
        var rows = participants.ToArray();
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken); await using var transaction = connection.BeginTransaction();
        var clear = connection.CreateCommand(); clear.Transaction = transaction; clear.CommandText = "DELETE FROM delivery_audit; DELETE FROM participants;"; await clear.ExecuteNonQueryAsync(cancellationToken);
        foreach (var person in rows)
        {
            var command = connection.CreateCommand(); command.Transaction = transaction;
            command.CommandText = "INSERT INTO participants(number,chip,name,name_folded,cpf,birth_date,sex,shirt,modality,category) VALUES($number,$chip,$name,$folded,$cpf,$birth,$sex,$shirt,$modality,$category)";
            command.Parameters.AddWithValue("$number", person.Number); command.Parameters.AddWithValue("$chip", person.Chip); command.Parameters.AddWithValue("$name", person.Name); command.Parameters.AddWithValue("$folded", NameSearch.Fold(person.Name));
            command.Parameters.AddWithValue("$cpf", (object?)person.Cpf ?? DBNull.Value); command.Parameters.AddWithValue("$birth", (object?)person.BirthDate ?? DBNull.Value); command.Parameters.AddWithValue("$sex", (object?)person.Sex ?? DBNull.Value); command.Parameters.AddWithValue("$shirt", (object?)person.Shirt ?? DBNull.Value); command.Parameters.AddWithValue("$modality", (object?)person.Modality ?? DBNull.Value); command.Parameters.AddWithValue("$category", (object?)person.Category ?? DBNull.Value);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return new ImportReport(rows.Length, blankRows, invalidRows, issues.Count(issue => issue.Contains("duplicado", StringComparison.OrdinalIgnoreCase)), issues);
    }

    public async Task<IReadOnlyList<Participant>> FindByChipsAsync(IReadOnlyCollection<string> chips, CancellationToken cancellationToken = default)
    {
        if (chips.Count == 0) return [];
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        var parameterNames = chips.Select((chip, index) => { var parameter = "$chip" + index; command.Parameters.AddWithValue(parameter, ChipIdentifierResolver.Normalize(chip)); return parameter; });
        command.CommandText = $"SELECT id,number,chip,name,cpf,birth_date,sex,shirt,modality,category,delivered_at,receiver_name FROM participants WHERE upper(chip) IN ({string.Join(',', parameterNames)})";
        var result = new List<Participant>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(ReadParticipant(reader));
        return result;
    }

    public async Task<IReadOnlyList<Participant>> SearchByNameAsync(string query, CancellationToken cancellationToken = default)
    {
        var folded = NameSearch.Fold(query);
        if (folded.Length == 0) return await ListAllAsync(cancellationToken);

        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id,number,chip,name,cpf,birth_date,sex,shirt,modality,category,delivered_at,receiver_name
            FROM participants
            WHERE name_folded LIKE $folded OR name LIKE $raw OR number LIKE $raw
            ORDER BY name
            """;
        command.Parameters.AddWithValue("$folded", "%" + folded + "%");
        command.Parameters.AddWithValue("$raw", "%" + query.Trim() + "%");
        var result = new List<Participant>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(ReadParticipant(reader));
        return result;
    }

    public async Task<IReadOnlyList<Participant>> ListAllAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id,number,chip,name,cpf,birth_date,sex,shirt,modality,category,delivered_at,receiver_name FROM participants ORDER BY name";
        var result = new List<Participant>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(ReadParticipant(reader));
        return result;
    }

    public async Task<IReadOnlyList<Participant>> ListDeliveredAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id,number,chip,name,cpf,birth_date,sex,shirt,modality,category,delivered_at,receiver_name FROM participants WHERE delivered_at IS NOT NULL ORDER BY delivered_at DESC";
        var result = new List<Participant>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add(ReadParticipant(reader));
        return result;
    }

    public async Task ConfirmDeliveryAsync(long participantId, string epc, string operatorName, DateTimeOffset at, string? receiverName = null, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken); await using var transaction = connection.BeginTransaction();
        var update = connection.CreateCommand(); update.Transaction = transaction;
        update.CommandText = "UPDATE participants SET delivered_at=$at, receiver_name=$receiver WHERE id=$id AND delivered_at IS NULL";
        update.Parameters.AddWithValue("$at", at.ToString("O"));
        update.Parameters.AddWithValue("$receiver", (object?)receiverName ?? DBNull.Value);
        update.Parameters.AddWithValue("$id", participantId);
        if (await update.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException("O kit já foi confirmado por outra operação.");
        var audit = connection.CreateCommand(); audit.Transaction = transaction;
        audit.CommandText = "INSERT INTO delivery_audit(participant_id,epc,operator_name,delivered_at,receiver_name) VALUES($id,$epc,$operator,$at,$receiver)";
        audit.Parameters.AddWithValue("$id", participantId);
        audit.Parameters.AddWithValue("$epc", epc);
        audit.Parameters.AddWithValue("$operator", string.IsNullOrWhiteSpace(operatorName) ? "Operador" : operatorName.Trim());
        audit.Parameters.AddWithValue("$at", at.ToString("O"));
        audit.Parameters.AddWithValue("$receiver", (object?)receiverName ?? DBNull.Value);
        await audit.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static Participant ReadParticipant(SqliteDataReader reader)
        => new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9), reader.IsDBNull(10) ? null : DateTimeOffset.Parse(reader.GetString(10)), reader.FieldCount > 11 && !reader.IsDBNull(11) ? reader.GetString(11) : null);
}
