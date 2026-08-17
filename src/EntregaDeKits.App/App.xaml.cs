namespace EntregaDeKits.App;
public partial class App : System.Windows.Application
{
    protected override void OnStartup(System.Windows.StartupEventArgs eventArgs)
    {
        DispatcherUnhandledException += (_, args) =>
        {
            args.Handled = true;
            System.Windows.MessageBox.Show(
                "A operação foi interrompida, mas o sistema permanece aberto.\n\n" + args.Exception.Message,
                "Entrega de Kits CHIPOWER",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Warning);
        };
        base.OnStartup(eventArgs);
        try
        {
            System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.SoftwareOnly;
            var window = new MainWindow();
            MainWindow = window;
            window.Show();
        }
        catch (Exception exception)
        {
            System.Windows.MessageBox.Show(
                $"Não foi possível iniciar a Central de Entrega de Kits.\n\n{exception.Message}",
                "Falha na inicialização",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Error);
            Shutdown(-1);
        }
    }
}
