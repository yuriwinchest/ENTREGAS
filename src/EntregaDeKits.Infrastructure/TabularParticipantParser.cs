using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

internal static class TabularParticipantParser
{
    public static (IReadOnlyList<Participant> Participants, ImportReport Report) Parse(IReadOnlyList<IReadOnlyList<string>> rows)
    {
        var people = new List<Participant>();
        var issues = new List<string>();
        var seenChips = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var blanks = 0;
        var invalid = 0;
        var duplicates = 0;
        if (rows.Count == 0) return (people, new ImportReport(0, 0, 0, 0, ["O arquivo não contém linhas de corredores."]));

        var headerIndex = rows.ToList().FindIndex(row => ParticipantFieldMap.HasIdentity(ParticipantFieldMap.MapColumns(row)));
        IReadOnlyDictionary<int, RunnerField> columns;
        var dataStart = 0;
        if (headerIndex >= 0)
        {
            columns = ParticipantFieldMap.MapColumns(rows[headerIndex]);
            dataStart = headerIndex + 1;
        }
        else
        {
            columns = GuessColumns(rows[0]);
            if (!ParticipantFieldMap.HasIdentity(columns))
                throw new InvalidDataException("Não foi possível identificar as colunas de nome e número do corredor.");
        }

        for (var index = dataStart; index < rows.Count; index++)
        {
            var row = rows[index];
            string Cell(RunnerField field)
            {
                var column = columns.FirstOrDefault(item => item.Value == field);
                if (column.Value != field || column.Key >= row.Count) return string.Empty;
                return row[column.Key].Trim();
            }

            var number = Cell(RunnerField.Number);
            var chip = Cell(RunnerField.Chip);
            var name = Cell(RunnerField.Name);
            if (string.IsNullOrWhiteSpace(number) && string.IsNullOrWhiteSpace(chip) && string.IsNullOrWhiteSpace(name))
            {
                blanks++;
                continue;
            }

            if (string.IsNullOrWhiteSpace(name) || (string.IsNullOrWhiteSpace(number) && string.IsNullOrWhiteSpace(chip)))
            {
                invalid++;
                issues.Add($"Linha {index + 1}: nome e número (ou CHIP) são obrigatórios.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(number)) number = chip;
            chip = ChipIdentifierResolver.Normalize(string.IsNullOrWhiteSpace(chip) ? number : chip);
            if (!seenChips.Add(chip))
            {
                duplicates++;
                issues.Add($"Linha {index + 1}: CHIP/número duplicado '{chip}'.");
            }

            people.Add(new Participant(0, number, chip, name, EmptyToNull(Cell(RunnerField.Cpf)), EmptyToNull(Cell(RunnerField.BirthDate)), EmptyToNull(Cell(RunnerField.Sex)), EmptyToNull(Cell(RunnerField.Shirt)), EmptyToNull(Cell(RunnerField.Modality)), EmptyToNull(Cell(RunnerField.Category))));
        }

        return (people, new ImportReport(people.Count, blanks, invalid, duplicates, issues));
    }

    private static IReadOnlyDictionary<int, RunnerField> GuessColumns(IReadOnlyList<string> sample)
    {
        var map = new Dictionary<int, RunnerField>();
        for (var index = 0; index < sample.Count; index++)
        {
            var value = sample[index].Trim();
            if (value.Length == 0) continue;
            if (!map.ContainsValue(RunnerField.Number) && value.All(character => char.IsDigit(character) || character is '-' or '.') && value.Any(char.IsDigit))
                map[index] = RunnerField.Number;
            else if (!map.ContainsValue(RunnerField.Name) && value.Any(char.IsLetter) && value.Count(char.IsLetter) >= 3)
                map[index] = RunnerField.Name;
        }
        return map;
    }

    private static string? EmptyToNull(string value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
