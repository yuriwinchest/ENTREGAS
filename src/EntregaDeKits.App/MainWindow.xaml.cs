using EntregaDeKits.Core;
using EntregaDeKits.Infrastructure;
using System.Windows;
using System.IO;
using OpenFileDialog = Microsoft.Win32.OpenFileDialog;
using MessageBox = System.Windows.MessageBox;

namespace EntregaDeKits.App;

public partial class MainWindow : Window
{
    private readonly SqliteParticipantRepository _repository;
    private readonly DeliveryService _delivery;
    private readonly EventSettingsStore _settings;
    private readonly SimulatedRfidReader _simulator = new();
    private readonly SemaphoreSlim _workflowGate = new(1, 1);
    private IRfidReaderClient? _realReader;
    private PresentationWindow? _presentation;
    private DeliveryResult? _current;
    private bool _closingAfterReaderRelease;
    private volatile bool _isReplacingImport;
    private long _workflowGeneration;
    private IReadOnlyList<Participant> _roster = [];
    private IReadOnlyList<Participant> _filtered = [];
    private IReadOnlyList<Participant> _delivered = [];
    private int _page = 1;

    public MainWindow()
    {
        InitializeComponent();
        FitToWorkArea();
        InitializePassage();
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Chipower", "EntregaDeKits", "eventos.db");
        _repository = new SqliteParticipantRepository(path);
        _settings = new EventSettingsStore(Path.GetDirectoryName(path)!); _settings.Load();
        _delivery = new DeliveryService(_repository, new ChipIdentifierResolver());
        Loaded += async (_, _) =>
        {
            try
            {
                await _repository.InitializeAsync();
                await ReloadRosterAsync();
                await RefreshDeliveredListAsync();
                await _simulator.StartAsync("simulador", [1], ProcessReadAsync);
            }
            catch (Exception exception)
            {
                MessageBox.Show("A base local não pôde ser aberta.\n\n" + exception.Message, "Inicialização", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        };
        Closing += OnClosing;
    }

    private void FitToWorkArea()
    {
        const double edgeMargin = 24;
        var workArea = SystemParameters.WorkArea;
        MaxWidth = Math.Max(MinWidth, workArea.Width);
        MaxHeight = Math.Max(MinHeight, workArea.Height);
        Width = Math.Min(1320, Math.Max(MinWidth, workArea.Width - edgeMargin));
        Height = Math.Min(Math.Max(MinHeight, workArea.Height - edgeMargin), workArea.Height - edgeMargin);
    }

    private async Task ProcessReadAsync(TagRead read, CancellationToken cancellationToken)
    {
        var generation = Interlocked.Read(ref _workflowGeneration);
        await _workflowGate.WaitAsync(cancellationToken);
        try
        {
            if (_isReplacingImport || generation != Interlocked.Read(ref _workflowGeneration)) return;
            var result = await _delivery.ProcessReadAsync(read, cancellationToken);
            if (generation != Interlocked.Read(ref _workflowGeneration)) return;
            if (Dispatcher.CheckAccess()) ShowResult(result);
            else await Dispatcher.InvokeAsync(() => ShowResult(result));
        }
        finally { _workflowGate.Release(); }
    }

    private void ShowResult(DeliveryResult result, bool refreshQueue = true)
    {
        _current = result;
        var display = DisplayModel.From(result); StateText.Text = display.State; ParticipantText.Text = display.Name;
        DetailsText.Text = display.Detail + (result.Participant is null ? string.Empty : $"\nNº {result.Participant.Number}  •  CHIP {result.Participant.Chip}\nCamisa: {result.Participant.Shirt ?? "—"}  |  {result.Participant.Modality ?? "—"}  |  {result.Participant.Category ?? "—"}");
        OperationNotice.Text = result.State == DeliveryState.AwaitingConfirmation ? "Participante incluído na fila. Confirme a entrega após conferir o kit." : result.Message;
        if (!InPassageMode) _presentation?.Update(display);
        if (result.Participant is not null) ShowRunnerCard(result.Participant, display.State);
        if (refreshQueue) RefreshQueue();
    }

    private void RefreshQueue()
    {
        var selectedId = _current?.Participant?.Id;
        var queue = _delivery.PendingQueue;
        QueueList.ItemsSource = queue;
        QueueList.SelectedItem = queue.FirstOrDefault(item => item.Participant?.Id == selectedId);
    }

    private void QueueList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (QueueList.SelectedItem is DeliveryResult result) ShowResult(result, false);
    }

    private async void ImportExcel_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog { Filter = "Planilhas Excel (*.xlsx)|*.xlsx", InitialDirectory = AppContext.BaseDirectory };
        if (dialog.ShowDialog() == true) await ImportFromPathAsync(dialog.FileName);
    }

    private async void AttachList_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "Lista de corredores (*.txt;*.csv;*.xml;*.pdf;*.xlsx)|*.txt;*.csv;*.xml;*.pdf;*.xlsx|Texto (*.txt;*.csv)|*.txt;*.csv|XML (*.xml)|*.xml|PDF (*.pdf)|*.pdf|Excel (*.xlsx)|*.xlsx",
            InitialDirectory = AppContext.BaseDirectory
        };
        if (dialog.ShowDialog() == true) await ImportFromPathAsync(dialog.FileName);
    }

    private async Task ImportFromPathAsync(string path)
    {
        try
        {
            var (participants, report) = new RunnerListImporter().Read(path);
            var confirmation = MessageBox.Show("Esta importação substituirá a lista atual e apagará todas as entregas auditadas nesta instalação. Confirma a substituição?", "Confirmar substituição da lista", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (confirmation != MessageBoxResult.Yes) return;
            _isReplacingImport = true;
            Interlocked.Increment(ref _workflowGeneration);
            await _workflowGate.WaitAsync();
            try
            {
                var saved = await _repository.ReplaceParticipantsAsync(participants, report.Issues, report.BlankRows, report.InvalidRows);
                _delivery.ClearPending(); _current = null; RefreshQueue();
                NameSearchBox.Text = string.Empty;
                _page = 1;
                await ReloadRosterAsync();
                await RefreshDeliveredListAsync();
                UpdateProgressBoard();
                var idle = DisplayModel.Idle; StateText.Text = idle.State; ParticipantText.Text = "Lista importada. Os corredores já estão na lista."; DetailsText.Text = idle.Detail; _presentation?.Update(idle);
                var summary = $"Importados: {saved.Imported}  •  Vazias: {saved.BlankRows}  •  Inválidas: {saved.InvalidRows}  •  Duplicados: {saved.DuplicateChips}" + (saved.Issues.Count > 0 ? "\nAvisos: " + string.Join(" | ", saved.Issues.Take(3)) : string.Empty);
                ImportReportText.Text = summary;
                DeliveryImportReportText.Text = summary;
                AttachedFileText.Text = $"{Path.GetFileName(path)}  •  {_roster.Count} corredores na lista";
                OperationNotice.Text = "Lista carregada. Digite o nome para filtrar.";
                DeliveryNotice.Text = _roster.Count == 0 ? "Nenhum corredor válido no arquivo." : $"{_roster.Count} corredores na lista. Digite o nome para filtrar.";
                ShowRunnerCard(null, "LISTA CARREGADA");
            }
            finally { _workflowGate.Release(); }
        }
        catch (Exception exception) { MessageBox.Show(exception.Message, "Importação não concluída", MessageBoxButton.OK, MessageBoxImage.Warning); }
        finally { _isReplacingImport = false; }
    }

    private async Task ReloadRosterAsync(bool resetPage = true)
    {
        _roster = await _delivery.ListRosterAsync();
        ApplyRosterFilter(resetPage);
        UpdateProgressBoard();
    }

    private void NameSearch_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        ApplyRosterFilter(resetPage: true);
        SelecionarPorIdentificador(NameSearchBox?.Text, limparBusca: false);
    }

    private void NameSearch_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key is not (System.Windows.Input.Key.Enter or System.Windows.Input.Key.Return)) return;

        // A leitora encerra a leitura com Enter. Sem tratar aqui, o codigo
        // seguinte ficaria grudado no anterior dentro do campo.
        e.Handled = true;
        SelecionarPorIdentificador(NameSearchBox.Text, limparBusca: true);
    }

    /// <summary>
    /// Abre a ficha quando o texto digitado é o CHIP ou o número de um corredor
    /// só. É por aqui que a leitora de mesa associa a etiqueta à pessoa: ela se
    /// comporta como teclado, digita o código no campo de busca e o corredor
    /// aparece sem ninguém precisar clicar na lista.
    ///
    /// Fica em silêncio quando o texto casa com mais de um corredor: melhor não
    /// escolher do que escolher errado na frente do atleta.
    /// </summary>
    private void SelecionarPorIdentificador(string? texto, bool limparBusca)
    {
        var consulta = (texto ?? string.Empty).Trim();
        if (consulta.Length == 0) return;

        var encontrados = _roster
            .Where(person => NameSearch.IsIdentifierOf(person.Number, person.Chip, consulta))
            .Take(2)
            .ToArray();

        if (encontrados.Length != 1) return;

        var participante = encontrados[0];
        if (_current?.Participant?.Id == participante.Id && !limparBusca) return;

        ShowResult(_delivery.SelectForDelivery(participante));

        if (!limparBusca) return;
        NameSearchBox.Text = string.Empty;
        NameSearchBox.Focus();
    }

    private void ClearSearch_Click(object sender, RoutedEventArgs e)
    {
        NameSearchBox.Text = string.Empty;
        NameSearchBox.Focus();
    }

    /// <summary>
    /// Esvazia a lista carregada.
    ///
    /// Antes só existia o "Limpar" ao lado da busca, que limpa o texto da busca
    /// e nada mais. Quem queria trocar de evento não tinha como zerar o que já
    /// estava carregado e ficava com a impressão de que o programa não limpava.
    /// </summary>
    private async void ClearRoster_Click(object sender, RoutedEventArgs e)
    {
        if (_roster.Count == 0)
        {
            DeliveryNotice.Text = "Não há lista carregada para limpar.";
            return;
        }

        var confirmacao = MessageBox.Show(
            $"Isto apaga os {_roster.Count} corredores carregados e as entregas registradas nesta instalação." + Environment.NewLine + Environment.NewLine + "Confirma limpar?",
            "Limpar lista",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (confirmacao != MessageBoxResult.Yes) return;

        _isReplacingImport = true;
        Interlocked.Increment(ref _workflowGeneration);
        await _workflowGate.WaitAsync();
        try
        {
            await _repository.ReplaceParticipantsAsync([], [], 0, 0);
            _delivery.ClearPending();
            _current = null;
            RefreshQueue();
            NameSearchBox.Text = string.Empty;
            _page = 1;
            await ReloadRosterAsync();
            await RefreshDeliveredListAsync();
            UpdateProgressBoard();

            AttachedFileText.Text = "Anexe o arquivo dos corredores (TXT, XML, PDF ou Excel).";
            DeliveryImportReportText.Text = string.Empty;
            ImportReportText.Text = string.Empty;
            DeliveryNotice.Text = "Lista limpa. Anexe o arquivo do próximo evento.";
            OperationNotice.Text = "Lista limpa.";
            ShowRunnerCard(null, "LISTA LIMPA");

            var idle = DisplayModel.Idle;
            StateText.Text = idle.State;
            ParticipantText.Text = idle.Name;
            DetailsText.Text = idle.Detail;
            if (!InPassageMode) _presentation?.Update(idle);
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message, "Limpeza não concluída", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            _workflowGate.Release();
            _isReplacingImport = false;
        }
    }

    private void PrevPage_Click(object sender, RoutedEventArgs e)
    {
        _page = RosterPager.ClampPage(_page - 1, _filtered.Count);
        ShowCurrentPage();
    }

    private void NextPage_Click(object sender, RoutedEventArgs e)
    {
        _page = RosterPager.ClampPage(_page + 1, _filtered.Count);
        ShowCurrentPage();
    }

    private void ApplyRosterFilter(bool resetPage = false)
    {
        if (SearchResults is null || RunnerListTitle is null || DeliveryNotice is null) return;
        var query = NameSearchBox?.Text ?? string.Empty;
        _filtered = NameSearch.Fold(query).Length == 0
            ? _roster
            : _roster.Where(person => NameSearch.Matches(person.Name, person.Number, person.Chip, query)).ToArray();
        if (resetPage) _page = 1;
        ShowCurrentPage();
        RunnerListTitle.Text = _filtered.Count == _roster.Count
            ? $"CORREDORES  •  {_roster.Count}"
            : $"CORREDORES  •  {_filtered.Count} de {_roster.Count}";
        if (_roster.Count == 0)
            DeliveryNotice.Text = "Anexe o arquivo para ver os corredores.";
        else if (_filtered.Count == 0)
            DeliveryNotice.Text = "Nenhum corredor com esse nome ou número.";
        else if (NameSearch.Fold(query).Length == 0)
            DeliveryNotice.Text = $"{_roster.Count} corredores. 10 por página.";
        else
            DeliveryNotice.Text = $"{_filtered.Count} corredor(es) com “{query.Trim()}”.";
    }

    private void ShowCurrentPage()
    {
        if (SearchResults is null || PageLabel is null || PrevPageButton is null || NextPageButton is null) return;
        _page = RosterPager.ClampPage(_page, _filtered.Count);
        var pages = RosterPager.PageCount(_filtered.Count);
        SearchResults.ItemsSource = RosterPager.TakePage(_filtered, _page);
        PageLabel.Text = $"Página {_page} de {pages}";
        PrevPageButton.IsEnabled = _page > 1;
        NextPageButton.IsEnabled = _page < pages;
    }

    private void SearchResults_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (SearchResults.SelectedItem is not Participant participant) return;
        var result = _delivery.SelectForDelivery(participant);
        ShowResult(result);
    }

    private void ShowRunnerCard(Participant? participant, string status)
    {
        if (participant is null)
        {
            RunnerNumberText.Text = "Nº —";
            RunnerNameText.Text = "Selecione um corredor na lista.";
            RunnerStatusText.Text = status;
            FieldNumber.Text = FieldChip.Text = FieldCpf.Text = FieldBirth.Text = FieldSex.Text = FieldShirt.Text = FieldModality.Text = FieldCategory.Text = FieldReceiver.Text = "—";
            return;
        }

        RunnerNumberText.Text = "Nº " + participant.Number;
        RunnerNameText.Text = participant.Name;
        RunnerStatusText.Text = status;
        FieldNumber.Text = EmptyDash(participant.Number);
        FieldChip.Text = EmptyDash(participant.Chip);
        FieldCpf.Text = EmptyDash(participant.Cpf);
        FieldBirth.Text = EmptyDash(participant.BirthDate);
        FieldSex.Text = EmptyDash(participant.Sex);
        FieldShirt.Text = EmptyDash(participant.Shirt);
        FieldModality.Text = EmptyDash(participant.Modality);
        FieldCategory.Text = EmptyDash(participant.Category);
        FieldReceiver.Text = participant.DeliveredAt is null ? "Ainda não retirado" : participant.PickupLabel;
    }

    private static string EmptyDash(string? value) => string.IsNullOrWhiteSpace(value) ? "—" : value;

    private async Task RefreshDeliveredListAsync()
    {
        _delivered = await _delivery.ListDeliveredAsync();
        ApplyDeliveredFilter();
    }

    private void DeliveredSearch_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e) => ApplyDeliveredFilter();

    private void ApplyDeliveredFilter()
    {
        if (DeliveredList is null || DeliveredTitle is null) return;
        var query = DeliveredSearchBox?.Text ?? string.Empty;
        var items = NameSearch.Fold(query).Length == 0
            ? _delivered
            : _delivered.Where(person => NameSearch.Matches(person.Name, person.Number, query)).ToArray();
        DeliveredList.ItemsSource = items;
        DeliveredTitle.Text = $"KITS ENTREGUES  •  {items.Count}";
    }

    private void MainTabs_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (!IsLoaded || !ReferenceEquals(e.OriginalSource, MainTabs) || MainTabs.SelectedItem is not System.Windows.Controls.TabItem tab) return;
        if (tab.Header as string == "LEITOR RFID")
        {
            OpenPresentation_Click(sender, new RoutedEventArgs());
            if (_current is null || _current.State == DeliveryState.AwaitingConfirmation)
                _presentation?.Update(DisplayModel.Idle);
        }
        if (tab.Header as string == "ENTREGUES")
            _ = RefreshDeliveredListAsync();

        // O telao pertence a aba que esta em cena: ao trocar de aba, ele passa
        // a mostrar o conteudo do modo correspondente.
        RefreshPresentationContent();
        if (tab.Header as string == "PASSAGEM") PassagemPanel.Refresh();
    }

    private async void Simulate_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(EpcInput.Text)) return;
        try { await _simulator.SimulateAsync(EpcInput.Text); } catch (Exception exception) { MessageBox.Show(exception.Message, "Leitura", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

    private void RevealThirdParty_Click(object sender, RoutedEventArgs e)
    {
        if (_current?.State != DeliveryState.AwaitingConfirmation || _current.Participant is null)
        {
            DeliveryNotice.Text = "Selecione um corredor pendente antes da entrega de terceiro.";
            return;
        }
        ThirdPartyPanel.Visibility = Visibility.Visible;
        ThirdPartyNameBox.Focus();
    }

    private async void ConfirmThirdParty_Click(object sender, RoutedEventArgs e)
        => await CompleteDeliveryAsync(ReceiverName.Normalize(ThirdPartyNameBox.Text), requireReceiver: true);

    private async void Confirm_Click(object sender, RoutedEventArgs e)
        => await CompleteDeliveryAsync(null, requireReceiver: false);

    private async Task CompleteDeliveryAsync(string? receiverName, bool requireReceiver)
    {
        if (_current?.State != DeliveryState.AwaitingConfirmation || _current.Participant is null)
        {
            const string missing = "Não há entrega pendente para confirmar.";
            OperationNotice.Text = missing;
            DeliveryNotice.Text = missing;
            return;
        }

        if (requireReceiver && receiverName is null)
        {
            DeliveryNotice.Text = "Informe o nome completo de quem está retirando o kit.";
            ThirdPartyPanel.Visibility = Visibility.Visible;
            ThirdPartyNameBox.Focus();
            return;
        }

        try
        {
            var confirmed = await _delivery.ConfirmAsync(_current.Participant.Id, "Operador", receiverName);
            if (confirmed is not null)
            {
                var detail = string.IsNullOrWhiteSpace(receiverName) ? "Entrega registrada localmente." : "Retirado por terceiro.";
                var completed = new DisplayModel("ENTREGA CONFIRMADA", confirmed.Participant!.Name, confirmed.Participant.Number, confirmed.Participant.Chip, confirmed.Participant.Shirt ?? "—", confirmed.Participant.Modality ?? "—", confirmed.Participant.Category ?? "—", detail);
                StateText.Text = completed.State; ParticipantText.Text = completed.Name; DetailsText.Text = detail; OperationNotice.Text = $"Entrega confirmada às {DateTime.Now:HH:mm}."; ShowRunnerCard(confirmed.Participant, completed.State); _presentation?.Update(completed); _current = null; RefreshQueue();
                ThirdPartyPanel.Visibility = Visibility.Collapsed;
                ThirdPartyNameBox.Text = string.Empty;
                await ReloadRosterAsync(resetPage: false);
                await RefreshDeliveredListAsync();
                DeliveryNotice.Text = string.IsNullOrWhiteSpace(receiverName) ? $"Entrega confirmada às {DateTime.Now:HH:mm}." : $"Entrega a terceiro ({receiverName}) às {DateTime.Now:HH:mm}.";
                var next = _delivery.PendingQueue.FirstOrDefault();
                if (next is not null) { QueueList.SelectedItem = next; ShowResult(next, false); }
            }
        }
        catch (Exception exception) { MessageBox.Show(exception.Message, "Confirmação", MessageBoxButton.OK, MessageBoxImage.Warning); }
    }

    private void UpdateProgressBoard()
    {
        if (StatDelivered is null || StatRemaining is null || StatPercent is null || DeliveredShare is null || RemainingShare is null) return;
        var stats = DeliveryStats.From(_roster);
        StatDelivered.Text = stats.Delivered.ToString();
        StatRemaining.Text = stats.Remaining.ToString();
        StatPercent.Text = stats.Total == 0 ? "0%" : $"{stats.Percent:0}%";
        DeliveredShare.Width = new GridLength(Math.Max(stats.Delivered, 0.001), GridUnitType.Star);
        RemainingShare.Width = new GridLength(Math.Max(stats.Remaining, 0.001), GridUnitType.Star);
    }

    private void OpenPresentation_Click(object sender, RoutedEventArgs e)
    {
        if (_presentation is { IsVisible: true })
        {
            _presentation.Activate();
            return;
        }
        ShowPresentationOn(PreferredScreenIndex());
    }

    private void Background_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog { Filter = "Imagens (*.jpg;*.jpeg;*.png)|*.jpg;*.jpeg;*.png" };
        if (dialog.ShowDialog() != true) return;
        _settings.SaveBackground(dialog.FileName); GetPresentation().SetBackground(dialog.FileName); OperationNotice.Text = "Fundo configurado e persistido para este evento.";
    }

    private async void StartReader_Click(object sender, RoutedEventArgs e)
    {
        if (_realReader is not null) return;
        var antennas = new[] { Antenna1.IsChecked == true ? 1 : 0, Antenna2.IsChecked == true ? 2 : 0, Antenna3.IsChecked == true ? 3 : 0, Antenna4.IsChecked == true ? 4 : 0 }.Where(value => value > 0).ToArray();
        try
        {
            _realReader = new ImpinjR420Reader(); _realReader.StateChanged += ReaderStateChanged;
            ReaderStatus.Text = "Conectando ao R420. Confirme que o ShipRed está completamente fechado.";
            await _realReader.StartAsync(ReaderIp.Text, antennas, ProcessReadAsync);
        }
        catch (Exception exception) { ReaderStatus.Text = "Falha no R420: " + exception.Message; if (_realReader is not null) { await _realReader.DisposeAsync(); _realReader = null; } }
    }

    private async void StopReader_Click(object sender, RoutedEventArgs e) => await StopRealReaderAsync();
    private PresentationWindow GetPresentation()
    {
        if (_presentation is not null) return _presentation;
        _presentation = new PresentationWindow();
        AttachPresentationHook(_presentation);
        _presentation.Closed += (_, _) =>
        {
            _presentation = null;
            ReleasePresentation();
        };
        return _presentation;
    }
    private async void OnClosing(object? sender, System.ComponentModel.CancelEventArgs eventArgs)
    {
        if (_closingAfterReaderRelease) return;
        eventArgs.Cancel = true;
        _closingAfterReaderRelease = true;
        DisposePassageHooks();
        await StopRealReaderAsync();
        await _simulator.DisposeAsync();
        Close();
    }
    private async Task StopRealReaderAsync()
    {
        if (_realReader is null) return;
        ReaderStatus.Text = "Encerrando leitura e liberando cliente LLRP...";
        try { await _realReader.StopAsync(); await _realReader.DisposeAsync(); ReaderStatus.Text = "R420 desconectado com segurança."; }
        catch (Exception exception) { ReaderStatus.Text = "Desconexão forçada: " + exception.Message; }
        finally { _realReader = null; }
    }
    private void ReaderStateChanged(object? sender, ReaderConnectionState state) => Dispatcher.BeginInvoke(() => ReaderStatus.Text = $"R420: {state}. ShipRed deve permanecer fechado durante esta conexão.");
}
