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

    public void SetBackground(string path)
    {
        if (!File.Exists(path)) return;

        var image = new BitmapImage();
        image.BeginInit();
        image.UriSource = new Uri(path, UriKind.Absolute);
        image.CacheOption = BitmapCacheOption.OnLoad;
        image.EndInit();
        BackgroundImage.Source = image;
    }
}
