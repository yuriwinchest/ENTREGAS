using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

/// <summary>
/// A leitora de mesa digita o código no campo de busca do balcão. A busca
/// comparava apenas nome e número, então passar o chip do corredor nunca
/// encontrava ninguém — foi o defeito relatado no teste com a cliente.
/// </summary>
public class BuscaPorChipTests
{
    private const string Nome = "ADILSON CAVALCANTI ARAUJO JUNIOR";
    private const string Numero = "105";
    private const string Chip = "52025";

    private static bool Procura(string consulta) => NameSearch.Matches(Nome, Numero, Chip, consulta);

    [Fact]
    public void ChipDaPlanilhaEncontraOCorredor() => Assert.True(Procura(Chip));

    [Fact]
    public void EpcHexadecimalDaLeitoraEncontraOCorredor()
    {
        // 52025 decimal = CB39 hexadecimal, no formato de EPC de 96 bits.
        Assert.True(Procura("00000000000000000000CB39"));
    }

    [Fact]
    public void NomeContinuaEncontrando() => Assert.True(Procura("adilson cavalcanti"));

    [Fact]
    public void NumeroDePeitoContinuaEncontrando() => Assert.True(Procura("105"));

    [Fact]
    public void ChipDeOutroCorredorNaoEncontra() => Assert.False(Procura("51921"));

    [Fact]
    public void NomeComEspacoNaoEInterpretadoComoEtiqueta()
    {
        // Sem esta guarda, cada tecla de um nome dispararia conversao numerica.
        Assert.False(Procura("nao existe aqui"));
    }

    [Fact]
    public void TextoCurtoDemaisNaoEncaraComoIdentificador()
        => Assert.False(NameSearch.IsIdentifierOf(Numero, Chip, "52"));

    [Fact]
    public void IdentificadorReconheceChipENumero()
    {
        Assert.True(NameSearch.IsIdentifierOf(Numero, Chip, Chip));
        Assert.True(NameSearch.IsIdentifierOf(Numero, Chip, "105"));
        Assert.True(NameSearch.IsIdentifierOf(Numero, Chip, "00000000000000000000CB39"));
    }

    [Fact]
    public void PedacoDeNomeNaoEIdentificador()
    {
        // O filtro da lista pode casar por trecho do nome, mas abrir a ficha
        // sozinho exige o identificador exato: escolher errado na frente do
        // atleta e pior do que nao escolher.
        Assert.False(NameSearch.IsIdentifierOf(Numero, Chip, "adilson"));
    }

    [Fact]
    public void ChipComEspacosOuTracosDaLeitoraAindaEncontra()
        => Assert.True(Procura("0000-0000-0000-0000-0000-CB39"));
}
