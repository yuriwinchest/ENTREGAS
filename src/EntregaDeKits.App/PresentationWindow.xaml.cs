using System.Windows;
using EntregaDeKits.Core;

namespace EntregaDeKits.App;

/// <summary>
/// O telão em si: a janela sem bordas que vai para a televisão.
///
/// O desenho não mora mais aqui — mora no <see cref="Views.TelaoBoard"/>, o
/// mesmo controle que a aba TELÃO usa como prévia. Esta janela só decide ONDE
/// aquilo aparece; o QUE aparece é definido em um lugar só.
/// </summary>
public partial class PresentationWindow : Window
{
    public PresentationWindow() => InitializeComponent();

    /// <summary>Título da faixa superior, para distinguir balcão de passagem.</summary>
    public string BoardTitle
    {
        get => Board.Title;
        set => Board.Title = value;
    }

    public void Update(DisplayModel model) => Board.Update(model);

    public void SetBackground(string path) => Board.SetBackground(path);

    private void Close_Click(object sender, RoutedEventArgs eventArgs) => Close();

    private void Window_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs eventArgs)
    {
        if (eventArgs.Key != System.Windows.Input.Key.Escape) return;
        eventArgs.Handled = true;
        Close();
    }
}
