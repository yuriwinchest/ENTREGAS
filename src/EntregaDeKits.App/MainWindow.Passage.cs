using System.Windows;
using System.Windows.Controls;
using EntregaDeKits.Core;
using EntregaDeKits.Infrastructure;
using Forms = System.Windows.Forms;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;

namespace EntregaDeKits.App;

/// <summary>
/// O modo PASSAGEM: o corredor passa o chip na leitora de mesa e o telão mostra
/// quem ele é.
///
/// Vive num arquivo separado do balcão de propósito. São duas operações
/// distintas — uma entrega kit e audita, a outra só identifica e exibe — e
/// misturá-las no mesmo arquivo faria a janela principal passar de 500 linhas
/// e embaralhar dois fluxos que não compartilham estado.
///
/// A única coisa que os dois modos disputam é a janela do telão, que é uma só.
/// Quem manda nela é a aba ativa: em PASSAGEM ou TELÃO o balcão não escreve no
/// telão, e vice-versa.
/// </summary>
public partial class MainWindow
{
    private readonly PassageSession _passage = new();
    private ChipBindingStore? _bindingStore;
    private ChipBindings _bindings = new();
    private KeyboardWedgeHook? _mainHook;
    private KeyboardWedgeHook? _presentationHook;

    /// <summary>A aba aberta é uma das duas do modo passagem?</summary>
    private bool InPassageMode => AbaAtual is "PASSAGEM" or "TELÃO";

    /// <summary>
    /// A leitora vale nesta aba?
    ///
    /// O balcão entrou aqui depois do teste com a cliente. A captura só
    /// funcionava se o cursor estivesse dentro do campo de busca — e assim que
    /// a operadora clica num corredor da lista, o foco sai do campo e as teclas
    /// da leitora se perdem no vazio. Passar o chip não fazia nada.
    ///
    /// O gancho se desarma sozinho quando um campo de texto está em foco, então
    /// digitar o nome na busca continua funcionando normalmente.
    /// </summary>
    private bool LeitoraVale => AbaAtual is "ENTREGA DE KITS" or "PASSAGEM" or "TELÃO";

    private string? AbaAtual => (MainTabs.SelectedItem as TabItem)?.Header as string;

    private void InitializePassage()
    {
        PassagemPanel.Attach(_passage);
        PassagemPanel.IsArmed = () => InPassageMode;
        PassagemPanel.RosterLoaded += (_, _) => PushPassageToPresentation();

        TelaoPanel.Attach(_passage);
        TelaoPanel.DetachRequested = ShowPresentationOn;
        TelaoPanel.ReattachRequested = () => _presentation?.Close();
        TelaoPanel.BackgroundRequested = ChoosePresentationBackground;

        // A leitora digita em quem estiver com o foco. Na janela principal a
        // captura só vale nas abas do modo passagem, para não atrapalhar o
        // balcão; a janela do telão ganha o gancho dela quando é aberta.
        _mainHook = new KeyboardWedgeHook(this, () => LeitoraVale, OnTagRead);

        // As ligacoes etiqueta-corredor vivem em disco e valem para os dois
        // modos: o que se ensina no balcao serve na passagem, e vice-versa.
        _bindingStore = new ChipBindingStore(PastaDeDados());
        _bindings = _bindingStore.Load();
        _passage.Bindings = _bindings;
        AtualizarAvisoDeAssociacao();

        _passage.Changed += (_, _) => PushPassageToPresentation();
    }

    /// <summary>
    /// Uma etiqueta passou na leitora. O destino depende da aba em cena.
    ///
    /// No balcão a leitura abre a ficha do corredor — e como o telão espelha o
    /// balcão, ele muda junto, que é o comportamento esperado: passou o chip,
    /// apareceu a pessoa. No modo passagem a leitura alimenta a sessão própria.
    /// </summary>
    private void OnTagRead(string code)
    {
        // Modo de ensino: a etiqueta lida passa a pertencer ao corredor que
        // esta na ficha, em vez de ser procurada na lista.
        if (BindingModeBox?.IsChecked == true)
        {
            AssociarEtiqueta(code);
            return;
        }

        if (InPassageMode)
        {
            _passage.Read(code, DateTimeOffset.Now);
            return;
        }

        SelecionarPorIdentificador(code, limparBusca: false);
    }

    /// <summary>
    /// Ensina que esta etiqueta pertence ao corredor selecionado.
    ///
    /// Sem corredor na ficha nao ha o que ensinar: gravar a etiqueta para
    /// "ninguem" so criaria lixo, e ligar ao corredor errado faria o telao
    /// anunciar a pessoa errada depois.
    /// </summary>
    private void AssociarEtiqueta(string code)
    {
        var corredor = _current?.Participant;
        if (corredor is null)
        {
            DeliveryNotice.Text = "Escolha o corredor na lista antes de passar a etiqueta.";
            return;
        }

        if (!_bindings.Bind(code, corredor.Chip))
        {
            DeliveryNotice.Text = "A leitura veio vazia. Passe a etiqueta novamente.";
            return;
        }

        _bindingStore?.Save(_bindings);
        DeliveryNotice.Text = $"Etiqueta {PassageKeys.Normalize(code)} associada a {corredor.Name} (CHIP {corredor.Chip}).";
        AtualizarAvisoDeAssociacao();
    }

    private void BindingMode_Changed(object sender, RoutedEventArgs eventArgs) => AtualizarAvisoDeAssociacao();

    private void AtualizarAvisoDeAssociacao()
    {
        if (BindingHintText is null || BindingModeBox is null) return;

        BindingHintText.Text = BindingModeBox.IsChecked == true
            ? "Ligado: escolha o corredor na lista e passe a etiqueta. Ela sera gravada para ele e o telao passa a reconhece-la."
            : $"Use quando o codigo da etiqueta nao for o CHIP da planilha: escolha o corredor, ligue esta opcao e passe a etiqueta uma vez. Ja gravadas: {_bindings.Count}.";
    }

    private static string PastaDeDados()
        => System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Chipower", "EntregaDeKits");

    /// <summary>Só escreve no telão quando o modo passagem está em cena.</summary>
    private void PushPassageToPresentation()
    {
        if (!InPassageMode || _presentation is null) return;
        _presentation.BoardTitle = "PASSAGEM";
        _presentation.Update(_passage.Display);
    }

    /// <summary>Abre o telão no monitor pedido e o deixa em tela cheia.</summary>
    private void ShowPresentationOn(int screenIndex)
    {
        var screens = Forms.Screen.AllScreens;
        var target = screens[Math.Clamp(screenIndex, 0, screens.Length - 1)];
        var presentation = GetPresentation();

        presentation.WindowState = WindowState.Normal;
        presentation.Left = target.Bounds.Left;
        presentation.Top = target.Bounds.Top;
        presentation.Width = target.Bounds.Width;
        presentation.Height = target.Bounds.Height;

        if (!string.IsNullOrWhiteSpace(_settings.BackgroundPath))
            presentation.SetBackground(_settings.BackgroundPath);

        presentation.Show();
        presentation.WindowState = WindowState.Maximized;
        presentation.Activate();

        TelaoPanel.SetDetached(true);
        RefreshPresentationContent();
    }

    /// <summary>Índice do monitor onde o telão deve nascer: o segundo, se existir.</summary>
    private static int PreferredScreenIndex()
    {
        var screens = Forms.Screen.AllScreens;
        var secondary = Array.FindIndex(screens, screen => !screen.Primary);
        return secondary >= 0 ? secondary : 0;
    }

    /// <summary>Reenvia ao telão o conteúdo do modo que está em cena.</summary>
    private void RefreshPresentationContent()
    {
        if (_presentation is null) return;

        if (InPassageMode)
        {
            PushPassageToPresentation();
            return;
        }

        _presentation.BoardTitle = "ENTREGA DE KITS";
        _presentation.Update(_current is null ? DisplayModel.Idle : DisplayModel.From(_current));
    }

    private void ChoosePresentationBackground()
    {
        var dialog = new OpenFileDialog { Filter = "Imagens (*.jpg;*.jpeg;*.png)|*.jpg;*.jpeg;*.png" };
        if (dialog.ShowDialog() != true) return;

        _settings.SaveBackground(dialog.FileName);
        TelaoPanel.SetBackground(dialog.FileName);
        _presentation?.SetBackground(dialog.FileName);
    }

    /// <summary>Chamado quando a janela do telão nasce, para ela também ouvir a leitora.</summary>
    private void AttachPresentationHook(PresentationWindow presentation)
    {
        _presentationHook?.Dispose();
        _presentationHook = new KeyboardWedgeHook(presentation, () => LeitoraVale, OnTagRead);
    }

    /// <summary>Chamado quando a janela do telão é fechada.</summary>
    private void ReleasePresentation()
    {
        _presentationHook?.Dispose();
        _presentationHook = null;
        TelaoPanel.SetDetached(false);
    }

    private void DisposePassageHooks()
    {
        _mainHook?.Dispose();
        _mainHook = null;
        _presentationHook?.Dispose();
        _presentationHook = null;
    }
}
