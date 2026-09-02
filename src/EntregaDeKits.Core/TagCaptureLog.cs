namespace EntregaDeKits.Core;

/// <summary>Uma etiqueta distinta vista na sessão, com a contagem de passagens.</summary>
public sealed record TagCaptureRow(string Code, int Reads, DateTimeOffset FirstAt, DateTimeOffset LastAt)
{
    public string FirstAtLabel => FirstAt.ToString("HH:mm:ss.fff");
    public string LastAtLabel => LastAt.ToString("HH:mm:ss.fff");
}

/// <summary>
/// Registro bruto das leituras, no espírito da tela técnica do ChipReader.
///
/// Registra TODA passagem, inclusive as repetidas que a tela principal ignora
/// para não piscar: enquanto a etiqueta estiver no campo da antena, a leitora
/// reporta o mesmo código muitas vezes por segundo, e é justamente essa
/// contagem que diz se a antena está pegando bem ou de raspão.
///
/// Antena e intensidade (dBm) não têm coluna aqui de propósito: em modo teclado
/// a leitora manda apenas o código. Quem quiser esses dois campos precisa da
/// conexão pelo SDK, não do modo teclado.
/// </summary>
public sealed class TagCaptureLog
{
    private readonly int _capacity;
    private readonly List<TagCaptureRow> _rows = [];

    public TagCaptureLog(int capacity = 100)
    {
        if (capacity <= 0) throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    /// <summary>Mais recente primeiro.</summary>
    public IReadOnlyList<TagCaptureRow> Rows => _rows;

    /// <summary>Total de passagens somando as repetições.</summary>
    public int TotalReads => _rows.Sum(row => row.Reads);

    /// <summary>Quantas etiquetas distintas apareceram.</summary>
    public int DistinctTags => _rows.Count;

    public TagCaptureRow Register(string code, DateTimeOffset at)
    {
        var index = _rows.FindIndex(row => string.Equals(row.Code, code, StringComparison.Ordinal));
        if (index >= 0)
        {
            var updated = _rows[index] with { Reads = _rows[index].Reads + 1, LastAt = at };
            _rows.RemoveAt(index);
            _rows.Insert(0, updated);
            return updated;
        }

        var created = new TagCaptureRow(code, 1, at, at);
        _rows.Insert(0, created);
        if (_rows.Count > _capacity) _rows.RemoveRange(_capacity, _rows.Count - _capacity);
        return created;
    }

    public void Clear() => _rows.Clear();
}
