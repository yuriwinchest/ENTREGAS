using System.Windows.Media.Imaging;
using System.Windows;
using System.IO;
using EntregaDeKits.Core;

namespace EntregaDeKits.App;
public partial class PresentationWindow : Window
{
    public PresentationWindow() { InitializeComponent(); Update(DisplayModel.Idle); }
    private void Close_Click(object sender, RoutedEventArgs eventArgs) => Close();
    private void Window_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs eventArgs)
    {
        if (eventArgs.Key != System.Windows.Input.Key.Escape) return;
        eventArgs.Handled = true;
        Close();
    }
    public void Update(DisplayModel model)
    {
        State.Text = model.State; ParticipantName.Text = model.Name;
        Info.Text = string.Join("   •   ", new[] { string.IsNullOrWhiteSpace(model.Number) ? null : "Nº " + model.Number, string.IsNullOrWhiteSpace(model.Chip) ? null : "CHIP " + model.Chip, model.Shirt, model.Modality, model.Category }.Where(value => !string.IsNullOrWhiteSpace(value)));
        Detail.Text = model.Detail;
    }
    public void SetBackground(string path)
    {
        if (!File.Exists(path)) return;
        var image = new BitmapImage(); image.BeginInit(); image.UriSource = new Uri(path, UriKind.Absolute); image.CacheOption = BitmapCacheOption.OnLoad; image.EndInit(); BackgroundImage.Source = image;
    }
}
