using System.Text.Json;

namespace EntregaDeKits.Infrastructure;

public sealed class EventSettingsStore
{
    private readonly string _path;
    private readonly string _assetsDirectory;
    public EventSettingsStore(string directory)
    {
        _path = Path.Combine(directory, "event-settings.json");
        _assetsDirectory = Path.Combine(directory, "event-assets");
    }
    public string? BackgroundPath { get; private set; }
    public void Load()
    {
        if (!File.Exists(_path)) return;
        try { BackgroundPath = JsonSerializer.Deserialize<Settings>(File.ReadAllText(_path))?.BackgroundPath; } catch (JsonException) { BackgroundPath = null; }
    }
    public void SaveBackground(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("A imagem escolhida não foi encontrada.", path);
        var extension = Path.GetExtension(path).ToLowerInvariant();
        if (extension is not ".jpg" and not ".jpeg" and not ".png") throw new InvalidDataException("O fundo deve ser JPG, JPEG ou PNG.");
        Directory.CreateDirectory(_assetsDirectory);
        var destination = Path.Combine(_assetsDirectory, "background" + extension);
        var temporary = destination + ".tmp";
        File.Copy(path, temporary, true);
        File.Move(temporary, destination, true);
        BackgroundPath = destination;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        File.WriteAllText(_path, JsonSerializer.Serialize(new Settings(destination)));
    }
    private sealed record Settings(string BackgroundPath);
}
