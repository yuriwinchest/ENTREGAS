using System.Windows;
using UserControl = System.Windows.Controls.UserControl;
using EntregaDeKits.Core;
using Forms = System.Windows.Forms;

namespace EntregaDeKits.App.Views;

/// <summary>
/// A aba do telão: a prévia do que o público vê, e o botão que a manda para a TV.
///
/// A prévia usa o MESMO controle da janela que vai para a televisão, então o
/// que aparece aqui é literalmente o que está lá — não é uma imitação que pode
/// divergir com o tempo.
///
/// A janela do telão pertence à <c>MainWindow</c>, não a esta aba: o programa
/// tem um telão só, e quem o abre pelo balcão ou pela passagem precisa cair na
/// mesma janela. Por isso aqui só existem pedidos (<see cref="DetachRequested"/>,
/// <see cref="ReattachRequested"/>) e quem executa é a janela principal.
/// </summary>
public partial class TelaoView : UserControl
{
    private PassageSession? _session;

    public TelaoView()
    {
        InitializeComponent();
        Loaded += (_, _) => PopulateScreens();
        SetDetached(false);
    }

    /// <summary>Pedido de abrir o telão no monitor escolhido (índice em Screen.AllScreens).</summary>
    public Action<int>? DetachRequested { get; set; }

    /// <summary>Pedido de fechar a janela do telão.</summary>
    public Action? ReattachRequested { get; set; }

    /// <summary>Pedido de trocar a imagem de fundo.</summary>
    public Action? BackgroundRequested { get; set; }

    public void Attach(PassageSession session)
    {
        _session = session;
        Board.Title = "PASSAGEM";
        session.Changed += (_, _) => Refresh();
        Refresh();
    }

    public void Refresh()
    {
        if (_session is null) return;
        Board.Update(_session.Display);
    }

    public void SetBackground(string path) => Board.SetBackground(path);

    public void SetDetached(bool detached)
    {
        DetachedVeil.Visibility = detached ? Visibility.Visible : Visibility.Collapsed;
        DetachButton.IsEnabled = !detached;
        ReattachButton.IsEnabled = detached;
        DetachedWhereText.Text = detached ? DescribeSelectedScreen() : string.Empty;
    }

    /// <summary>
    /// Lista os monitores conectados. Com um monitor só, "destacar" ainda serve:
    /// a janela abre por cima e pode ser arrastada, mas o aviso deixa claro que
    /// ela vai cobrir a tela de trabalho.
    /// </summary>
    private void PopulateScreens()
    {
        var screens = Forms.Screen.AllScreens;
        ScreenPicker.ItemsSource = screens
            .Select((screen, index) => Describe(screen, index))
            .ToArray();

        // Com dois monitores o telão vai para o secundário, que é onde a TV está.
        var preferred = Array.FindIndex(screens, screen => !screen.Primary);
        ScreenPicker.SelectedIndex = preferred >= 0 ? preferred : 0;

        StatusText.Text = screens.Length > 1
            ? "O telão abre numa janela própria, sem bordas. Feche pelo botão do canto ou pela tecla Esc."
            : "Só há um monitor conectado: o telão vai cobrir esta tela. Ligue a televisão como segundo monitor antes de destacar, ou feche com a tecla Esc.";
    }

    private static string Describe(Forms.Screen screen, int index)
    {
        // O papel só é afirmado quando é positivo. Chamar de "secundário" todo
        // monitor que não se declara principal já rotulou errado o único
        // monitor de uma máquina, o que confunde na hora de escolher a TV.
        var role = screen.Primary ? " (principal)" : string.Empty;
        return $"Monitor {index + 1}{role} — {screen.Bounds.Width}×{screen.Bounds.Height}";
    }

    private string DescribeSelectedScreen()
    {
        var chosen = ScreenPicker.SelectedItem as string;
        return string.IsNullOrWhiteSpace(chosen) ? string.Empty : "Exibindo em " + chosen;
    }

    private void Detach_Click(object sender, RoutedEventArgs eventArgs)
        => DetachRequested?.Invoke(Math.Max(0, ScreenPicker.SelectedIndex));

    private void Reattach_Click(object sender, RoutedEventArgs eventArgs) => ReattachRequested?.Invoke();

    private void Background_Click(object sender, RoutedEventArgs eventArgs) => BackgroundRequested?.Invoke();
}
