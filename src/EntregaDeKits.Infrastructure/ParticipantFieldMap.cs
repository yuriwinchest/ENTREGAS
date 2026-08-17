using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

internal enum RunnerField
{
    Number, Chip, Name, Cpf, BirthDate, Sex, Shirt, Modality, Category
}

internal static class ParticipantFieldMap
{
    private static readonly Dictionary<string, RunnerField> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["num"] = RunnerField.Number,
        ["numero"] = RunnerField.Number,
        ["n"] = RunnerField.Number,
        ["peito"] = RunnerField.Number,
        ["bib"] = RunnerField.Number,
        ["inscricao"] = RunnerField.Number,
        ["chip"] = RunnerField.Chip,
        ["epc"] = RunnerField.Chip,
        ["tag"] = RunnerField.Chip,
        ["inscrito"] = RunnerField.Name,
        ["nome"] = RunnerField.Name,
        ["name"] = RunnerField.Name,
        ["corredor"] = RunnerField.Name,
        ["atleta"] = RunnerField.Name,
        ["cpf"] = RunnerField.Cpf,
        ["data de nascimento"] = RunnerField.BirthDate,
        ["nascimento"] = RunnerField.BirthDate,
        ["datanascimento"] = RunnerField.BirthDate,
        ["dn"] = RunnerField.BirthDate,
        ["sexo"] = RunnerField.Sex,
        ["genero"] = RunnerField.Sex,
        ["camisa"] = RunnerField.Shirt,
        ["tamanho"] = RunnerField.Shirt,
        ["shirt"] = RunnerField.Shirt,
        ["modalidade"] = RunnerField.Modality,
        ["prova"] = RunnerField.Modality,
        ["distancia"] = RunnerField.Modality,
        ["categoria"] = RunnerField.Category
    };

    public static IReadOnlyDictionary<int, RunnerField> MapColumns(IReadOnlyList<string> headers)
    {
        var map = new Dictionary<int, RunnerField>();
        for (var index = 0; index < headers.Count; index++)
        {
            if (!TryResolve(headers[index], out var field)) continue;
            if (map.ContainsValue(field)) continue;
            map[index] = field;
        }
        return map;
    }

    public static bool TryResolve(string? header, out RunnerField field)
    {
        field = default;
        var key = NameSearch.Fold(header);
        if (key.Length == 0) return false;
        return Aliases.TryGetValue(key, out field);
    }

    public static bool HasIdentity(IReadOnlyDictionary<int, RunnerField> columns)
        => columns.Values.Contains(RunnerField.Name) && (columns.Values.Contains(RunnerField.Number) || columns.Values.Contains(RunnerField.Chip));
}
