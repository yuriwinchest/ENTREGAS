using EntregaDeKits.Core;

namespace EntregaDeKits.Tests;

public class PassageSessionTests
{
    private static readonly DateTimeOffset Moment = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static Participant Corredor(long id, string number, string chip, string name)
        => new(id, number, chip, name, null, null, null, "M", "10KM", "GERAL");

    private static PassageSession ComLista(params Participant[] people)
    {
        var session = new PassageSession();
        session.LoadRoster("lista.xlsx", people);
        return session;
    }

    [Fact]
    public void LeituraDoChipDaPlanilhaIdentificaOCorredor()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        var read = session.Read("51921", Moment);

        Assert.True(read.Found);
        Assert.Equal("ADILSON GONSALVES", read.Runner!.Name);
    }

    [Fact]
    public void EpcHexadecimalDaLeitoraIdentificaOChipDecimalDaPlanilha()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        var read = session.Read("00000000000000000000CAD1", Moment);

        Assert.True(read.Found);
        Assert.Equal("ADILSON GONSALVES", read.Runner!.Name);
    }

    [Fact]
    public void EtiquetaDesconhecidaNaoInventaCorredor()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        var read = session.Read("E20034120137FA00019025B1", Moment);

        Assert.False(read.Found);
        Assert.NotEmpty(read.TriedKeys);
    }

    [Fact]
    public void ChipRepetidoEntreCorredoresNaoIdentificaNinguem()
    {
        // Melhor não achar do que anunciar o corredor errado no telão.
        var session = ComLista(
            Corredor(1, "1", "51921", "PRIMEIRO"),
            Corredor(2, "2", "51921", "SEGUNDO"));

        Assert.False(session.Read("51921", Moment).Found);
        Assert.Contains("51921", session.AmbiguousKeys);
    }

    [Fact]
    public void PassagemRepetidaContaMasNaoRedesenhaOTelao()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        session.Read("51921", Moment);
        var primeiraExibicao = session.Display;
        session.Read("51921", Moment.AddMilliseconds(120));
        session.Read("51921", Moment.AddMilliseconds(240));

        Assert.Equal(3, session.Capture.Rows.Single().Reads);
        Assert.Equal(primeiraExibicao.Detail, session.Display.Detail);
    }

    [Fact]
    public void DepoisDaJanelaDeRepeticaoOTelaoVoltaAAtualizar()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        session.Read("51921", Moment);
        session.Read("51921", Moment.AddSeconds(10));

        Assert.Equal("Leitura às 12:00:10", session.Display.Detail);
    }

    [Fact]
    public void SemListaOTelaoPedeAPlanilha()
    {
        Assert.Equal("ANEXE A LISTA", new PassageSession().Display.State);
    }

    [Fact]
    public void ComListaESemLeituraOTelaoConvidaAPassarOChip()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON GONSALVES"));

        Assert.Equal("APROXIME O CHIP", session.Display.State);
        Assert.Contains("1 inscritos", session.Display.Detail);
    }

    [Fact]
    public void OTelaoNaoRecebeCpfNemNascimento()
    {
        // O telão fica virado para o público: dado sensível não pode chegar lá.
        var pessoa = new Participant(1, "1", "51921", "ADILSON", "755.216.365-87", "25/05/1975", "M", "G", "10KM", "GERAL");
        var session = ComLista(pessoa);

        session.Read("51921", Moment);
        var telao = session.Display;
        var tudoQueApareceNoTelao = string.Join("|", telao.State, telao.Name, telao.Number, telao.Chip, telao.Shirt, telao.Modality, telao.Category, telao.Detail);

        Assert.DoesNotContain("755.216.365-87", tudoQueApareceNoTelao);
        Assert.DoesNotContain("25/05/1975", tudoQueApareceNoTelao);
    }

    [Fact]
    public void TrocarDeListaLimpaACapturaAnterior()
    {
        var session = ComLista(Corredor(1, "1", "51921", "PRIMEIRO"));
        session.Read("51921", Moment);

        session.LoadRoster("outra.xlsx", [Corredor(2, "2", "60651", "SEGUNDO")]);

        Assert.Empty(session.Capture.Rows);
        Assert.Null(session.Last);
    }

    [Fact]
    public void EtiquetaLidaAntesDaListaAindaApareceNoTelao()
    {
        // E justamente sem lista que se descobre QUAL codigo a leitora emite:
        // engolir a leitura em silencio esconderia a unica pista disponivel.
        var session = new PassageSession();

        session.Read("E20034120137FA00019025B1", Moment);

        Assert.Equal("E20034120137FA00019025B1", session.Display.Name);
        Assert.Single(session.Capture.Rows);
    }

    [Fact]
    public void CadaLeituraAvisaQuemEstaOuvindo()
    {
        var session = ComLista(Corredor(1, "1", "51921", "ADILSON"));
        var avisos = 0;
        session.Changed += (_, _) => avisos++;

        session.Read("51921", Moment);

        Assert.Equal(1, avisos);
    }
}
