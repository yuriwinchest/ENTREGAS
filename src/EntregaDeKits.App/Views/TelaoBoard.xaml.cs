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
        Info.Text = string.Join("   •   ", new[]
        {
            string.IsNullOrWhiteSpace(model.Number) ? null : "Nº " + model.Number,
            string.IsNullOrWhiteSpace(model.Chip) ? null : "CHIP " + model.Chip,
            model.Shirt,
            model.Modality,
            model.Category
        }.Where(value => !string.IsNullOrWhiteSpace(value)));

        // Sem dados do corredor a faixa fica vazia: escondê-la evita um
        // retângulo cinza solto no meio do telão, visto pelo público.
        InfoBox.Visibility = Info.Text.Length == 0
            ? System.Windows.Visibility.Collapsed
            : System.Windows.Visibility.Visible;
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
