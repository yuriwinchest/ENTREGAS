using System.Text;

namespace EntregaDeKits.Core;

/// <summary>
/// Reconhece a leitora de mesa que se apresenta ao Windows como um TECLADO.
///
/// A CPH-F206 não precisa de driver nem de SDK: ela "digita" o código da
/// etiqueta e termina com Enter, exatamente como uma pessoa faria. O problema é
/// justamente esse — como separar a leitora de alguém digitando?
///
/// Pela CADÊNCIA. A leitora despeja os caracteres em poucos milissegundos; a
/// mão humana leva dezenas. Uma pausa maior que <see cref="_maxGapMilliseconds"/>
/// entre teclas zera o acúmulo, então uma digitação normal nunca chega ao fim
/// com um código completo: quando o Enter humano chega, o buffer guarda no
/// máximo o último caractere, abaixo do tamanho mínimo, e nada é emitido.
///
/// É a mesma regra já validada na versão web, mantida idêntica de propósito:
/// se a Aline calibrar a leitora e funcionar em um lado, funciona no outro.
/// </summary>
public sealed class KeyboardWedgeDecoder
{
    private readonly int _maxGapMilliseconds;
    private readonly int _minimumLength;
    private readonly StringBuilder _buffer = new();
    private DateTimeOffset? _lastKeyAt;

    public KeyboardWedgeDecoder(int maxGapMilliseconds = 60, int minimumLength = 4)
    {
        if (maxGapMilliseconds <= 0) throw new ArgumentOutOfRangeException(nameof(maxGapMilliseconds));
        if (minimumLength <= 0) throw new ArgumentOutOfRangeException(nameof(minimumLength));
        _maxGapMilliseconds = maxGapMilliseconds;
        _minimumLength = minimumLength;
    }

    /// <summary>Quantos caracteres já se acumularam na rajada atual.</summary>
    public int BurstLength => _buffer.Length;

    public void Feed(char character, DateTimeOffset at)
    {
        if (char.IsControl(character)) return;

        var gap = _lastKeyAt is null ? 0 : (at - _lastKeyAt.Value).TotalMilliseconds;
        _lastKeyAt = at;

        // Pausa longa = digitação humana: a rajada anterior não vale mais.
        if (gap > _maxGapMilliseconds) _buffer.Clear();

        _buffer.Append(character);
    }

    /// <summary>Enter recebido. Devolve o código quando a rajada tem cara de leitora.</summary>
    ///
    /// <remarks>
    /// O Enter NÃO precisa chegar dentro da janela de cadência, e isso é uma
    /// decisão, não um esquecimento: várias leitoras HID mandam o sufixo Enter
    /// com um atraso próprio, configurável, bem maior que o intervalo entre os
    /// caracteres. Exigir cadência também no Enter recusaria justamente a
    /// leitora que já funciona na versão web.
    ///
    /// A proteção contra disparo acidental continua sendo o acúmulo: uma pausa
    /// humana entre teclas zera o buffer, então quando o Enter chega não há
    /// código completo para emitir.
    /// </remarks>
    public string? Submit(DateTimeOffset at)
    {
        var code = _buffer.ToString().Trim();
        Reset();
        return code.Length >= _minimumLength ? code.ToUpperInvariant() : null;
    }

    public void Reset()
    {
        _buffer.Clear();
        _lastKeyAt = null;
    }
}
