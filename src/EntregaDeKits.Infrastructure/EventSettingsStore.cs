using System.Text.Json;

namespace EntregaDeKits.Infrastructure;

/// <summary>
/// Guarda as imagens do evento: o fundo do telão e o logo da prova.
///
/// São coisas diferentes de propósito. O fundo ocupa a tela inteira e precisa
/// ficar atrás do texto, então leva um véu escuro por cima para o nome do
/// corredor continuar legível de longe. O logo aparece limpo no alto, sem véu
/// nenhum — é ali que a marca da prova tem que ser reconhecida.
///
/// Usar a mesma arte para as duas coisas era o que deixava o logo apagado: ele
/// ia inteiro para o fundo e recebia o escurecimento junto.
/// </summary>
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

    /// <summary>Logo da prova, exibido limpo no alto do telão.</summary>
    public string? LogoPath { get; private set; }

    public void Load()
    {
        if (!File.Exists(_path)) return;

        try
        {
            var settings = JsonSerializer.Deserialize<Settings>(File.ReadAllText(_path));
            BackgroundPath = Existente(settings?.BackgroundPath);
            LogoPath = Existente(settings?.LogoPath);
        }
        catch (JsonException)
        {
            BackgroundPath = null;
            LogoPath = null;
        }
    }

    public void SaveBackground(string path)
    {
        BackgroundPath = Copiar(path, "background");
        Persistir();
    }

    public void SaveLogo(string path)
    {
        LogoPath = Copiar(path, "logo");
        Persistir();
    }

    public void ClearLogo()
    {
        LogoPath = null;
        Persistir();
    }

    /// <summary>
    /// Copia a imagem para a pasta do evento. Guardar só o caminho original
    /// deixaria o telão em branco assim que alguém movesse o arquivo.
    /// </summary>
    private string Copiar(string path, string nome)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("A imagem escolhida não foi encontrada.", path);

        var extension = Path.GetExtension(path).ToLowerInvariant();
        if (extension is not ".jpg" and not ".jpeg" and not ".png")
            throw new InvalidDataException("A imagem deve ser JPG, JPEG ou PNG.");

        Directory.CreateDirectory(_assetsDirectory);
        var destination = Path.Combine(_assetsDirectory, nome + extension);
        var temporary = destination + ".tmp";
        File.Copy(path, temporary, true);
        File.Move(temporary, destination, true);
        return destination;
    }

    private void Persistir()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        File.WriteAllText(_path, JsonSerializer.Serialize(new Settings(BackgroundPath ?? string.Empty, LogoPath)));
    }

    private static string? Existente(string? path)
        => string.IsNullOrWhiteSpace(path) || !File.Exists(path) ? null : path;

    private sealed record Settings(string BackgroundPath, string? LogoPath = null);
}
