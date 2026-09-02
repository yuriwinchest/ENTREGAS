using System.IO;
using System.Windows;
using System.Windows.Threading;
using EntregaDeKits.Core;
using EntregaDeKits.Infrastructure;
using MessageBox = System.Windows.MessageBox;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;
using UserControl = System.Windows.Controls.UserControl;
using Brush = System.Windows.Media.Brush;
using KeyEventArgs = System.Windows.Input.KeyEventArgs;
using Key = System.Windows.Input.Key;

namespace EntregaDeKits.App.Views;

/// <summary>
/// A aba de leitura: o corredor passa o chip e o código aparece aqui.
///
/// Esta aba NÃO grava nada. A lista vem da planilha anexada e vive na memória
/// enquanto o programa estiver aberto — sem banco, sem migração e sem o aviso
/// de "isto vai apagar as entregas" que o balcão precisa dar. O balcão continua
/// com a base dele, separado disto.
///
/// O painel "POR QUE NÃO ACHEI" existe para o primeiro evento real: se o código
/// que a leitora digita não tiver relação com o CHIP da planilha, esta tela diz
/// exatamente quais escritas foram tentadas. Um print resolve o diagnóstico que
/// de outro modo levaria dias de tentativa e erro.
/// </summary>
public partial class PassagemView : UserControl
{
    /// <summary>Uma linha da tabela de captura, já pronta para a tela.</summary>
    private sealed record CaptureRowView(int Position, string Code, string FirstAt, string LastAt, int Reads, string Runner);

    private readonly DispatcherTimer _armedWatch = new() { Interval = TimeSpan.FromMilliseconds(400) };
    private PassageSession? _session;

    public PassagemView()
    {
        InitializeComponent();
        _armedWatch.Tick += (_, _) => RefreshArmedBadge();
        IsVisibleChanged += (_, _) =>
        {
            if (IsVisible) _armedWatch.Start(); else _armedWatch.Stop();
        };
    }

    /// <summary>Perguntado à janela: a captura está armada neste momento?</summary>
    public Func<bool> IsArmed { get; set; } = () => false;

    /// <summary>Disparado quando uma lista nova é anexada.</summary>
    public event EventHandler? RosterLoaded;

    public void Attach(PassageSession session)
    {
        _session = session;
        session.Changed += (_, _) => Refresh();
        Refresh();
    }

    public void Refresh()
    {
        if (_session is null) return;

        RosterText.Text = _session.HasRoster
            ? $"{_session.SourceFile}  •  {_session.RosterCount} inscritos na memória"
            : "Anexe a planilha dos inscritos (Excel, TXT, CSV, XML ou PDF).";

        var display = _session.Display;
        StateText.Text = display.State;
        RunnerText.Text = display.Name;

        var last = _session.Last;
        RunnerDetailText.Text = last?.Runner is null
            ? display.Detail
            : $"Nº {last.Runner.Number}  •  CHIP {last.Runner.Chip}  •  Camisa {Dash(last.Runner.Shirt)}  •  {Dash(last.Runner.Modality)}  •  {Dash(last.Runner.Category)}";

        ShowDiagnostic(last);
        RefreshCapture();
        RefreshArmedBadge();
    }

    /// <summary>Quando o chip não bate com ninguém, mostra o que foi procurado.</summary>
    private void ShowDiagnostic(PassageRead? last)
    {
        if (last is null || last.Found)
        {
            DiagnosticPanel.Visibility = Visibility.Collapsed;
            return;
        }

        DiagnosticPanel.Visibility = Visibility.Visible;
        DiagnosticText.Text =
            $"A leitora enviou “{last.Code}”. Procurei na lista por: {string.Join(", ", last.TriedKeys)}. "
            + "Nenhuma dessas formas existe na coluna CHIP nem na coluna NUM da planilha anexada. "
            + "Se o código lido não se parecer com o CHIP da planilha, a leitora está entregando outro identificador da etiqueta.";
    }

    private void RefreshCapture()
    {
        if (_session is null) return;

        var now = DateTimeOffset.Now;
        var rows = _session.Capture.Rows
            .Select((row, index) => new CaptureRowView(
                index + 1,
                row.Code,
                row.FirstAtLabel,
                row.LastAtLabel,
                row.Reads,
                _session.Resolve(row.Code, now).Runner?.Name ?? "não encontrado"))
            .ToArray();

        CaptureList.ItemsSource = rows;
        CaptureTitle.Text = rows.Length == 0
            ? "CAPTURA DAS TAGS"
            : $"CAPTURA DAS TAGS  •  {_session.Capture.DistinctTags} etiqueta(s)  •  {_session.Capture.TotalReads} passagem(ns)";
    }

    private void RefreshArmedBadge()
    {
        var armed = IsArmed();
        ArmedDot.Fill = armed ? Paint("Orange") : Paint("Muted");
        ArmedText.Text = armed
            ? "Leitora armada"
            : KeyboardWedgeHook.IsTypingInAField() ? "Pausada: campo em foco" : "Leitora pausada";
    }

    private Brush Paint(string resourceKey) => (Brush)FindResource(resourceKey);

    private static string Dash(string? value) => string.IsNullOrWhiteSpace(value) ? "—" : value;

    private void Attach_Click(object sender, RoutedEventArgs eventArgs)
    {
        if (_session is null) return;

        var dialog = new OpenFileDialog
        {
            Title = "Anexar a lista de inscritos",
            Filter = "Lista de inscritos (*.xlsx;*.txt;*.csv;*.xml;*.pdf)|*.xlsx;*.txt;*.csv;*.xml;*.pdf|Excel (*.xlsx)|*.xlsx|Texto (*.txt;*.csv)|*.txt;*.csv|XML (*.xml)|*.xml|PDF (*.pdf)|*.pdf"
        };
        if (dialog.ShowDialog() != true) return;

        try
        {
            var (participants, report) = new RunnerListImporter().Read(dialog.FileName);
            _session.LoadRoster(Path.GetFileName(dialog.FileName), participants);

            RosterDetailText.Text = BuildReportLine(report, _session.AmbiguousKeys.Count);
            RosterLoaded?.Invoke(this, EventArgs.Empty);
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message, "Lista não carregada", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static string BuildReportLine(ImportReport report, int ambiguous)
    {
        var line = $"Lidos: {report.Imported}  •  Vazias: {report.BlankRows}  •  Inválidas: {report.InvalidRows}  •  CHIP repetido: {report.DuplicateChips}";
        if (ambiguous > 0) line += $"  •  {ambiguous} chip(s) em mais de um corredor serão ignorados";
        return line;
    }

    private void ClearCapture_Click(object sender, RoutedEventArgs eventArgs) => _session?.ClearCapture();

    private void Simulate_Click(object sender, RoutedEventArgs eventArgs) => SimulateFromBox();

    private void ManualCode_KeyDown(object sender, KeyEventArgs eventArgs)
    {
        if (eventArgs.Key is not (Key.Enter or Key.Return)) return;
        eventArgs.Handled = true;
        SimulateFromBox();
    }

    private void SimulateFromBox()
    {
        var code = ManualCodeBox.Text.Trim();
        if (code.Length == 0 || _session is null) return;

        _session.Read(code, DateTimeOffset.Now);
        ManualCodeBox.Clear();
    }
}
