using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

/// <summary>
/// No teste real a leitora enviou "…19992" e a planilha trazia os chips 1001 a
/// 1013. Não existe conversão entre os dois: o número gravado dentro da
/// etiqueta não é o impresso nela. A ligação ensinada pelo operador é o que
/// resolve, e estes testes cobrem exatamente esse caminho.
/// </summary>
public class ChipBindingsTests
{
    private static readonly DateTimeOffset Momento = new(2026, 9, 5, 19, 0, 0, TimeSpan.Zero);

    private static Participant Corredor(long id, string numero, string chip, string nome)
        => new(id, numero, chip, nome, null, null, "F", "M", "10KM", "GERAL");

    [Fact]
    public void EtiquetaEnsinadaPassaAApontarParaOCorredor()
    {
        var bindings = new ChipBindings();
        bindings.Bind("000000000000000000019992", "1010");

        Assert.Equal("1010", bindings.Resolve("000000000000000000019992"));
    }

    [Fact]
    public void EtiquetaEnsinadaEmDecimalEReconhecidaEmHexadecimal()
    {
        var bindings = new ChipBindings();
        bindings.Bind("19992", "1010");

        // 19992 decimal = 4E18 hexadecimal.
        Assert.Equal("1010", bindings.Resolve("0000000000000000000004E18"));
    }

    [Fact]
    public void EtiquetaNuncaEnsinadaContinuaDesconhecida()
        => Assert.Null(new ChipBindings().Resolve("000000000000000000019992"));

    [Fact]
    public void RegravarAMesmaEtiquetaTrocaODono()
    {
        var bindings = new ChipBindings();
        bindings.Bind("19992", "1010");
        bindings.Bind("19992", "1007");

        Assert.Equal("1007", bindings.Resolve("19992"));
        Assert.Equal(1, bindings.Count);
    }

    [Fact]
    public void LeituraVaziaNaoCriaLigacao()
    {
        var bindings = new ChipBindings();

        Assert.False(bindings.Bind("   ", "1010"));
        Assert.False(bindings.Bind("19992", ""));
        Assert.Equal(0, bindings.Count);
    }

    [Fact]
    public void OTelaoPassaAIdentificarACorredoraDepoisDeEnsinar()
    {
        // O fluxo completo que a cliente vai usar no evento.
        var session = new PassageSession();
        session.LoadRoster("planilha.xlsx",
        [
            Corredor(1, "13", "1010", "ANGELICA MARIA DE LURDES"),
            Corredor(2, "10", "1007", "ANGELE MARIA"),
        ]);

        const string etiqueta = "000000000000000000019992";
        Assert.False(session.Read(etiqueta, Momento).Found);
        Assert.Equal("CHIP FORA DA LISTA", session.Display.State);

        session.Bindings.Bind(etiqueta, "1010");

        var leitura = session.Read(etiqueta, Momento.AddSeconds(10));
        Assert.True(leitura.Found);
        Assert.Equal("ANGELICA MARIA DE LURDES", leitura.Runner!.Name);
        Assert.Equal("CORREDOR IDENTIFICADO", session.Display.State);
        Assert.Equal("ANGELICA MARIA DE LURDES", session.Display.Name);
    }

    [Fact]
    public void EnsinarUmaEtiquetaNaoAfetaAsOutras()
    {
        var session = new PassageSession();
        session.LoadRoster("planilha.xlsx", [Corredor(1, "13", "1010", "ANGELICA")]);
        session.Bindings.Bind("19992", "1010");

        Assert.False(session.Read("88888", Momento).Found);
    }

    [Fact]
    public void ChipQueJaCasavaPeloNumeroContinuaCasando()
    {
        var session = new PassageSession();
        session.LoadRoster("planilha.xlsx", [Corredor(1, "13", "1010", "ANGELICA")]);
        session.Bindings.Bind("19992", "1010");

        Assert.True(session.Read("1010", Momento).Found);
    }

    [Fact]
    public void EsquecerRemoveALigacao()
    {
        var bindings = new ChipBindings();
        bindings.Bind("19992", "1010");

        Assert.True(bindings.Forget("19992"));
        Assert.Null(bindings.Resolve("19992"));
    }
}
