namespace EntregaDeKits.Core;

/// <summary>
/// Liga a etiqueta física ao corredor da planilha.
///
/// POR QUE ISTO PRECISOU EXISTIR: no teste real a leitora enviou
/// "…19992" enquanto a planilha trazia os chips 1001 a 1013. Não existe
/// conversão entre os dois — o número gravado dentro da etiqueta simplesmente
/// não é o número impresso nela. Enquanto for assim, nenhuma regra de
/// comparação vai adivinhar de quem é a etiqueta.
///
/// A saída é o operador ensinar uma vez: seleciona o corredor, passa a
/// etiqueta, e a ligação fica guardada. Da segunda passagem em diante o
/// corredor aparece sozinho.
///
/// A ligação é sempre EXPLÍCITA. Aprender sozinho, na primeira leitura
/// desconhecida, ligaria a etiqueta a quem estivesse selecionado por acaso — e
/// um telão anunciando o corredor errado é pior do que um telão em branco.
/// </summary>
public sealed class ChipBindings
{
    private readonly Dictionary<string, string> _porEtiqueta = new(StringComparer.Ordinal);

    /// <summary>Etiqueta lida (normalizada) -> CHIP do corredor na planilha.</summary>
    public IReadOnlyDictionary<string, string> Todas => _porEtiqueta;

    public int Count => _porEtiqueta.Count;

    public static ChipBindings From(IEnumerable<KeyValuePair<string, string>> pares)
    {
        var bindings = new ChipBindings();
        foreach (var par in pares) bindings.Bind(par.Key, par.Value);
        return bindings;
    }

    /// <summary>
    /// Guarda que esta etiqueta pertence a este corredor. Regravar a mesma
    /// etiqueta substitui a ligação anterior: se a etiqueta trocou de dono, a
    /// leitura mais recente é a que vale.
    /// </summary>
    public bool Bind(string? etiqueta, string? chipDoCorredor)
    {
        var chave = PassageKeys.Normalize(etiqueta);
        var valor = PassageKeys.Normalize(chipDoCorredor);
        if (chave.Length == 0 || valor.Length == 0) return false;

        _porEtiqueta[chave] = valor;
        return true;
    }

    public bool Forget(string? etiqueta)
    {
        var chave = PassageKeys.Normalize(etiqueta);
        return chave.Length > 0 && _porEtiqueta.Remove(chave);
    }

    public void Clear() => _porEtiqueta.Clear();

    /// <summary>
    /// O CHIP do corredor a quem esta etiqueta foi ligada, ou nulo.
    ///
    /// Tenta todas as escritas plausíveis da etiqueta lida: se a ligação foi
    /// gravada com o código em decimal e a leitura seguinte vier em
    /// hexadecimal, ainda assim se reconhece.
    /// </summary>
    public string? Resolve(string? etiqueta)
    {
        foreach (var forma in PassageKeys.Variants(etiqueta))
        {
            if (_porEtiqueta.TryGetValue(forma, out var chip)) return chip;
        }
        return null;
    }

    public bool Knows(string? etiqueta) => Resolve(etiqueta) is not null;
}
