using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using EntregaDeKits.Core;
using UserControl = System.Windows.Controls.UserControl;

namespace EntregaDeKits.App.Views;

public partial class TelaoBoard : UserControl
{
    public TelaoBoard()
    {
        InitializeComponent();
        Update(DisplayModel.Idle);
    }

    /// <summary>Título da faixa laranja no alto, para diferenciar balcão de passagem.</summary>
    public string Title
    {
        get => BoardTitle.Text;
        set => BoardTitle.Text = value;
    }

    public void Update(DisplayModel model)
    {
        State.Text = model.State;
        ParticipantName.Text = model.Name;

        // Sem número de peito o bloco inteiro sai de cena, para o nome ocupar
        // a largura toda em vez de conviver com um espaço vazio.
        var temNumero = !string.IsNullOrWhiteSpace(model.Number);
        NumberPanel.Visibility = temNumero ? Visibility.Visible : Visibility.Collapsed;
        Number.Text = temNumero ? model.Number : string.Empty;

        // A grade é o que a planilha trouxe: nada de rótulo com travessão.
        FieldList.ItemsSource = model.Fields;

        var recado = model.PublicDetail;
        Detail.Text = recado;
        Detail.Visibility = recado.Length == 0 ? Visibility.Collapsed : Visibility.Visible;
    }

    public void SetBackground(string? path) => BackgroundImage.Source = Carregar(path);

    /// <summary>
    /// Banner ou logo do evento, exibido inteiro no espaço de cima.
    ///
    /// Sem imagem o bloco de dados volta a ocupar o centro da tela: deixá-lo
    /// encostado embaixo com um vão enorme em cima ficaria desequilibrado.
    /// </summary>
    public void SetEventLogo(string? path)
    {
        var imagem = Carregar(path);
        EventLogo.Source = imagem;
        EventLogo.Visibility = imagem is null ? Visibility.Collapsed : Visibility.Visible;

        if (imagem is null)
        {
            Grid.SetRow(DataCard, 1);
            Grid.SetRowSpan(DataCard, 2);
            DataCard.VerticalAlignment = VerticalAlignment.Center;
            return;
        }

        Grid.SetRow(DataCard, 2);
        Grid.SetRowSpan(DataCard, 1);
        DataCard.VerticalAlignment = VerticalAlignment.Bottom;
    }

    /// <summary>
    /// Carrega a imagem inteira na memória e solta o arquivo. Sem OnLoad o WPF
    /// mantém o arquivo aberto, e trocar a arte do evento passaria a falhar por
    /// arquivo em uso.
    /// </summary>
    private static BitmapImage? Carregar(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;

        var image = new BitmapImage();
        image.BeginInit();
        image.UriSource = new Uri(path, UriKind.Absolute);
        image.CacheOption = BitmapCacheOption.OnLoad;
        image.EndInit();
        image.Freeze();
        return image;
    }
}
