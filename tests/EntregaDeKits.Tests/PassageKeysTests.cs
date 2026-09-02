using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

public class PassageKeysTests
{
    [Fact]
    public void ChipDecimalDaPlanilhaGeraOHexadecimalCorrespondente()
    {
        var variants = PassageKeys.Variants("51921");

        Assert.Contains("51921", variants);
        Assert.Contains("CAD1", variants);
        Assert.Contains("00000000000000000000CAD1", variants);
    }

    [Fact]
    public void EpcDaLeitoraGeraODecimalDaPlanilha()
    {
        var variants = PassageKeys.Variants("00000000000000000000CAD1");

        Assert.Contains("51921", variants);
        Assert.Contains("CAD1", variants);
    }

    [Fact]
    public void PlanilhaELeitoraSeEncontramPeloMenosNumaForma()
    {
        var daPlanilha = PassageKeys.Variants("51921");
        var daLeitora = PassageKeys.Variants("0000 0000 0000 0000 0000 CAD1");

        Assert.NotEmpty(daPlanilha.Intersect(daLeitora, StringComparer.Ordinal));
    }

    [Fact]
    public void DigitoPuroNuncaEInterpretadoComoHexadecimal()
    {
        // 0x51921 = 334113. Se dígito puro fosse lido como hexadecimal, este
        // chip casaria com o corredor de número 334113 — um falso positivo
        // anunciado no telão para o público.
        var variants = PassageKeys.Variants("51921");

        Assert.DoesNotContain("334113", variants);
    }

    [Fact]
    public void SeparadoresEEspacosNaoAtrapalhamAComparacao()
    {
        Assert.Equal(PassageKeys.Variants("E200-3412"), PassageKeys.Variants("e200 3412"));
    }

    [Fact]
    public void EpcQueCarregaTextoDevolveOTextoLegivel()
    {
        // "51921" gravado como ASCII dentro do EPC.
        var hex = Convert.ToHexString(System.Text.Encoding.ASCII.GetBytes("51921A"));

        Assert.Contains("51921A", PassageKeys.Variants(hex));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void EntradaVaziaNaoGeraChaveNenhuma(string? raw) => Assert.Empty(PassageKeys.Variants(raw));

    [Fact]
    public void ZerosAEsquerdaNaoSeparamOMesmoChip()
    {
        var comZeros = PassageKeys.Variants("0000051921");
        var semZeros = PassageKeys.Variants("51921");

        Assert.NotEmpty(comZeros.Intersect(semZeros, StringComparer.Ordinal));
    }
}
