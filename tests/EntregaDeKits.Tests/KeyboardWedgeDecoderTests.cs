using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

public class KeyboardWedgeDecoderTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static string? Digitar(KeyboardWedgeDecoder decoder, string text, int gapMilliseconds)
    {
        var moment = Start;
        foreach (var character in text)
        {
            decoder.Feed(character, moment);
            moment = moment.AddMilliseconds(gapMilliseconds);
        }
        return decoder.Submit(moment);
    }

    [Fact]
    public void RajadaRapidaTerminadaEmEnterEUmaLeitura()
    {
        var decoder = new KeyboardWedgeDecoder();

        Assert.Equal("E20034120137FA00019025B1", Digitar(decoder, "E20034120137FA00019025B1", gapMilliseconds: 8));
    }

    [Fact]
    public void DigitacaoHumanaNaoViraLeitura()
    {
        var decoder = new KeyboardWedgeDecoder();

        // 120ms entre teclas: cada pausa zera o acúmulo, sobra um caractere só.
        Assert.Null(Digitar(decoder, "ADRIANA", gapMilliseconds: 120));
    }

    [Fact]
    public void CodigoCurtoDemaisEDescartado()
    {
        var decoder = new KeyboardWedgeDecoder();

        Assert.Null(Digitar(decoder, "12", gapMilliseconds: 5));
    }

    [Fact]
    public void EnterSoltoMuitoDepoisDaRajadaNaoEmiteNada()
    {
        var decoder = new KeyboardWedgeDecoder();
        var moment = Start;
        foreach (var character in "51921")
        {
            decoder.Feed(character, moment);
            moment = moment.AddMilliseconds(6);
        }

        // O operador voltou dois segundos depois e apertou Enter num campo.
        Assert.Null(decoder.Submit(moment.AddSeconds(2)));
    }

    [Fact]
    public void CodigoSaiSempreEmMaiuscula()
    {
        var decoder = new KeyboardWedgeDecoder();

        Assert.Equal("E2003412", Digitar(decoder, "e2003412", gapMilliseconds: 5));
    }

    [Fact]
    public void DuasLeiturasSeguidasNaoSeMisturam()
    {
        var decoder = new KeyboardWedgeDecoder();

        Assert.Equal("51921", Digitar(decoder, "51921", gapMilliseconds: 5));
        Assert.Equal("51922", Digitar(decoder, "51922", gapMilliseconds: 5));
    }

    [Fact]
    public void OQueSobraDeUmaDigitacaoLentaNaoContaminaALeituraSeguinte()
    {
        var decoder = new KeyboardWedgeDecoder();
        var moment = Start;

        // Alguém digitou devagar e desistiu, sem Enter.
        foreach (var character in "ABC")
        {
            decoder.Feed(character, moment);
            moment = moment.AddMilliseconds(200);
        }

        // A leitora dispara logo em seguida.
        moment = moment.AddSeconds(1);
        foreach (var character in "51921")
        {
            decoder.Feed(character, moment);
            moment = moment.AddMilliseconds(5);
        }

        Assert.Equal("51921", decoder.Submit(moment));
    }
}
