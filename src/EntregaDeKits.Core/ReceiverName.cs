namespace EntregaDeKits.Core;

public static class ReceiverName
{
    public const int MinLength = 3;
    public const int MaxLength = 80;

    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (trimmed.Length < MinLength || !trimmed.Any(char.IsLetter)) return null;
        return trimmed.Length <= MaxLength ? trimmed : trimmed[..MaxLength].Trim();
    }
}
