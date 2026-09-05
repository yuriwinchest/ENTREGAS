using System.Text.Json;
using EntregaDeKits.Core;

namespace EntregaDeKits.Infrastructure;

/// <summary>
/// Guarda as ligações etiqueta-corredor em disco.
///
/// Precisa sobreviver ao fechamento do programa: ensinar 800 etiquetas de novo
/// a cada abertura seria inviável no dia do evento. Um JSON simples na mesma
/// pasta das configurações basta — são pares de texto curtos, sem dado pessoal.
/// </summary>
public sealed class ChipBindingStore
{
    private readonly string _path;

    public ChipBindingStore(string folder)
    {
        Directory.CreateDirectory(folder);
        _path = Path.Combine(folder, "etiquetas.json");
    }

    public ChipBindings Load()
    {
        if (!File.Exists(_path)) return new ChipBindings();

        try
        {
            using var stream = new FileStream(_path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            var pares = JsonSerializer.Deserialize<Dictionary<string, string>>(stream);
            return pares is null ? new ChipBindings() : ChipBindings.From(pares);
        }
        catch (Exception exception) when (exception is JsonException or IOException)
        {
            // Arquivo corrompido não pode impedir o evento de começar: perde-se
            // o aprendizado, não a operação.
            return new ChipBindings();
        }
    }

    public void Save(ChipBindings bindings)
    {
        var json = JsonSerializer.Serialize(bindings.Todas, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_path, json);
    }
}
