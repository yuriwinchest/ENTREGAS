using System.Windows;
using System.Windows.Controls;
using EntregaDeKits.Core;
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
    private KeyboardWedgeHook? _mainHook;
    private KeyboardWedgeHook? _presentationHook;

    /// <summary>A aba aberta é uma das duas do modo passagem?</summary>
    private bool InPassageMode
        => MainTabs.SelectedItem is TabItem tab && tab.Header as string is "PASSAGEM" or "TELÃO";

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
        _mainHook = new KeyboardWedgeHook(this, () => InPassageMode, OnTagRead);

        _passage.Changed += (_, _) => PushPassageToPresentation();
    }

    private void OnTagRead(string code) => _passage.Read(code, DateTimeOffset.Now);

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
        _presentationHook = new KeyboardWedgeHook(presentation, () => InPassageMode, OnTagRead);
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
