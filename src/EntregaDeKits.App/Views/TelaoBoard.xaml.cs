using System.IO;
using UserControl = System.Windows.Controls.UserControl;
using System.Windows.Media.Imaging;
using EntregaDeKits.Core;

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
        Detail.Text = model.Detail;

        // Sem número de peito o bloco inteiro sai de cena, para o nome ocupar
        // a largura toda em vez de conviver com um espaço vazio.
        var temNumero = !string.IsNullOrWhiteSpace(model.Number);
        NumberPanel.Visibility = temNumero
            ? System.Windows.Visibility.Visible
            : System.Windows.Visibility.Collapsed;
        Number.Text = temNumero ? model.Number : string.Empty;

        // A grade é o que a planilha trouxe: nada de rótulo com travessão.
        FieldList.ItemsSource = model.Fields;
    }

    public void SetBackground(string? path) => BackgroundImage.Source = Carregar(path);

    /// <summary>
    /// Logo da prova, exibido limpo no alto. Sem imagem o espaço some, para o
    /// cabeçalho não ficar com um vão no meio.
    /// </summary>
    public void SetEventLogo(string? path)
    {
        var imagem = Carregar(path);
        EventLogo.Source = imagem;
        EventLogo.Visibility = imagem is null
            ? System.Windows.Visibility.Collapsed
            : System.Windows.Visibility.Visible;
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
