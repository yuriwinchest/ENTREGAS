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

        // Nada mais a fazer com o layout: o bloco de dados estica sozinho para
        // ocupar o que sobra. Sem banner a faixa some e ele toma a tela toda;
        // com banner ele começa logo abaixo. Em nenhum dos casos fica vão.
    }

    /// <summary>
    /// Carrega a imagem a partir dos BYTES, não do caminho.
    ///
    /// POR QUE ASSIM: o WPF mantém um cache de imagens indexado pela URI, e as
    /// artes do evento são sempre gravadas no mesmo caminho ("logo.png"). Ao
    /// escolher um banner novo, o caminho não mudava e o WPF devolvia a imagem
    /// ANTIGA do cache — só reiniciando o programa a troca aparecia. Foi
    /// exatamente o que a operadora relatou.
    ///
    /// Lendo os bytes e alimentando o BitmapImage por stream não existe URI
    /// para cachear, e o arquivo é liberado logo em seguida.
    /// </summary>
    private static BitmapImage? Carregar(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;

        try
        {
            using var memoria = new MemoryStream(File.ReadAllBytes(path));

            var image = new BitmapImage();
            image.BeginInit();
            image.CacheOption = BitmapCacheOption.OnLoad;
            // Sem CreateOptions aqui: IgnoreImageCache junto com StreamSource
            // faz o WPF procurar a URI (nula) como chave de cache e lançar
            // ArgumentNullException. Carregar por stream já não passa pelo
            // cache de URI, então a opção era redundante além de fatal.
            image.StreamSource = memoria;
            image.EndInit();
            image.Freeze();
            return image;
        }
        catch (Exception exception) when (exception is IOException or NotSupportedException or ArgumentException)
        {
            // Arquivo corrompido ou formato que o WPF não abre: o telão fica
            // sem a arte, mas o evento não para por causa de uma imagem.
            return null;
        }
    }
}
