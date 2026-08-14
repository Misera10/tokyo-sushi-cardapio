using System.Collections.ObjectModel;
using Microsoft.Win32;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using TokyoSushi.PrintAgent.Models;
using TokyoSushi.PrintAgent.Services;

namespace TokyoSushi.PrintAgent;

public partial class MainWindow : Window
{
    private const string AppVersion = "0.3.17";
    private readonly AgentSettings _settings;
    private readonly PrinterService _printerService = new();
    private readonly PrintQueueService _queue;
    private readonly LocalAgentServer _server;
    private readonly ObservableCollection<PrinterInfo> _printers = new();
    private readonly ObservableCollection<PrintJob> _jobRows = new();
    private bool _suppressSettingsDirty;
    private System.Windows.Threading.DispatcherTimer? _saveStatusTimer;

    public MainWindow()
    {
        InitializeComponent();
        VersionText.Text = $"Tokyo Print v{AppVersion} · Windows";
        _settings = AgentSettings.Load();
        _queue = new PrintQueueService(_settings, _printerService);
        _server = new LocalAgentServer(_settings, _printerService, _queue);
        PrintersGrid.ItemsSource = _printers;
        JobsGrid.ItemsSource = _jobRows;
        _queue.JobsChanged += Queue_JobsChanged;
        LoadSettingsControls();
        BindSettingsChangeIndicators();
        Loaded += MainWindow_Loaded;
        Closing += (_, _) =>
        {
            _queue.Dispose();
            _server.Dispose();
        };
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            _server.Start();
            await RefreshPrintersAsync();
            RefreshJobs();
            if (_settings.StartMinimized) WindowState = WindowState.Minimized;
        }
        catch (Exception error)
        {
            AgentLog.Write(error);
            AgentStatusText.Text = "Atenção";
            TestStatusText.Text = $"O agente não conseguiu iniciar: {error.Message}";
        }
    }

    private async void RefreshButton_Click(object sender, RoutedEventArgs e) => await RefreshPrintersAsync();

    private async Task RefreshPrintersAsync()
    {
        RefreshButton.IsEnabled = false;
        TestStatusText.Text = "Consultando impressoras do Windows...";
        try
        {
            var printers = await Task.Run(() => _printerService.ListPrinters());
            _printers.Clear();
            foreach (var printer in printers) _printers.Add(printer);
            PrinterCountText.Text = _printers.Count.ToString();
            PrinterEmptyText.Visibility = _printers.Count == 0 ? Visibility.Visible : Visibility.Collapsed;

            // The Windows default is the source of truth. A previously saved
            // printer must not mask a new default after the user changes it.
            var selected = _printers.FirstOrDefault(printer => printer.IsDefault)
                ?? _printers.FirstOrDefault(printer => printer.Name == _settings.SelectedPrinter)
                ?? _printers.FirstOrDefault();
            if (selected is not null)
            {
                PrintersGrid.SelectedItem = selected;
                UpdateSelectedPrinter(selected);
                RefreshSettingsPrinterChoices(selected.Name);
            }
            else
            {
                SelectedPrinterText.Text = "Nenhuma";
                RefreshSettingsPrinterChoices(null);
                TestStatusText.Text = "Instale uma impressora no Windows para começar.";
            }
        }
        catch (Exception error)
        {
            AgentLog.Write(error);
            TestStatusText.Text = $"Não foi possível consultar as impressoras: {error.Message}";
        }
        finally
        {
            RefreshButton.IsEnabled = true;
        }
    }

    private void PrintersGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (PrintersGrid.SelectedItem is PrinterInfo printer) UpdateSelectedPrinter(printer);
    }

    private void UpdateSelectedPrinter(PrinterInfo printer)
    {
        _settings.SelectedPrinter = printer.Name;
        _settings.Save();
        SelectedPrinterText.Text = printer.Name;
        TestStatusText.Text = "Impressora selecionada. Faça um teste antes de ligar o automático.";
        RefreshSettingsPrinterChoices(printer.Name);
    }

    private async void TestPrintButton_Click(object sender, RoutedEventArgs e)
    {
        if (PrintersGrid.SelectedItem is not PrinterInfo printer)
        {
            TestStatusText.Text = "Selecione uma impressora primeiro.";
            return;
        }

        TestPrintButton.IsEnabled = false;
        TestStatusText.Text = "Enviando comanda para o spooler do Windows...";
        try
        {
            await Task.Run(() => _printerService.PrintTest(
                printer.Name,
                _settings.PaperWidth,
                _settings.PrintFontSize,
                ResolveMargin(_settings.MarginLeft),
                ResolveMargin(_settings.MarginRight),
                ResolveMargin(_settings.MarginTop),
                ResolveMargin(_settings.MarginBottom)));
            LastTestText.Text = DateTime.Now.ToString("HH:mm");
            TestStatusText.Text = "Comanda enviada. Confira a saída física da impressora.";
        }
        catch (Exception error)
        {
            AgentLog.Write(error);
            TestStatusText.Text = $"Falha ao imprimir: {error.Message}";
        }
        finally
        {
            TestPrintButton.IsEnabled = true;
        }
    }

    private void Queue_JobsChanged(object? sender, EventArgs e)
    {
        Dispatcher.BeginInvoke(RefreshJobs);
    }

    private void RefreshJobs()
    {
        _jobRows.Clear();
        foreach (var job in _queue.Snapshot()) _jobRows.Add(job);
        JobsEmptyText.Visibility = _jobRows.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void RetryJobButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not System.Windows.Controls.Button { Tag: string id }) return;
        TestStatusText.Text = _queue.Retry(id) ? "Trabalho reenviado para a fila." : "Este trabalho ainda está em andamento ou não pode ser repetido.";
    }

    private void NavigateOverview_Click(object sender, RoutedEventArgs e) => ContentScroll.ScrollToTop();
    private void NavigatePrinters_Click(object sender, RoutedEventArgs e) => PrintersGrid.BringIntoView();
    private void NavigateQueue_Click(object sender, RoutedEventArgs e) => QueueSection.BringIntoView();
    private void NavigateSettings_Click(object sender, RoutedEventArgs e) => SettingsSection.BringIntoView();

    private void LoadSettingsControls()
    {
        StartWithWindowsCheck.IsChecked = _settings.StartWithWindows;
        StartMinimizedCheck.IsChecked = _settings.StartMinimized;
        SettingsFontSizeText.Text = Math.Clamp(_settings.PrintFontSize, 6, 14).ToString();
        SettingsMarginLeftText.Text = ResolveMargin(_settings.MarginLeft).ToString();
        SettingsMarginRightText.Text = ResolveMargin(_settings.MarginRight).ToString();
        SettingsMarginTopText.Text = ResolveMargin(_settings.MarginTop).ToString();
        SettingsMarginBottomText.Text = ResolveMargin(_settings.MarginBottom).ToString();
        SelectPaperWidth(_settings.PaperWidth);
        RefreshSettingsPrinterChoices(_settings.SelectedPrinter);
    }

    private void RefreshSettingsPrinterChoices(string? selected)
    {
        _suppressSettingsDirty = true;
        try
        {
            var names = _printers.Select(printer => printer.Name).ToList();
            SettingsPrinterCombo.ItemsSource = names;
            SettingsPrinterCombo.SelectedItem = names.FirstOrDefault(name => name.Equals(selected, StringComparison.OrdinalIgnoreCase))
                ?? names.FirstOrDefault(name => _printers.FirstOrDefault(printer => printer.Name == name)?.IsDefault == true);
        }
        finally
        {
            _suppressSettingsDirty = false;
        }
    }

    private void SettingsPrinterCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (SettingsPrinterCombo.SelectedItem is string printerName && _printers.Any(printer => printer.Name == printerName))
        {
            _settings.SelectedPrinter = printerName;
            MarkSettingsDirty();
        }
    }

    private void BindSettingsChangeIndicators()
    {
        SettingsFontSizeText.TextChanged += (_, _) => MarkSettingsDirty();
        SettingsMarginLeftText.TextChanged += (_, _) => MarkSettingsDirty();
        SettingsMarginRightText.TextChanged += (_, _) => MarkSettingsDirty();
        SettingsMarginTopText.TextChanged += (_, _) => MarkSettingsDirty();
        SettingsMarginBottomText.TextChanged += (_, _) => MarkSettingsDirty();
        SettingsPaperWidthCombo.SelectionChanged += (_, _) => MarkSettingsDirty();
        StartWithWindowsCheck.Checked += (_, _) => MarkSettingsDirty();
        StartWithWindowsCheck.Unchecked += (_, _) => MarkSettingsDirty();
        StartMinimizedCheck.Checked += (_, _) => MarkSettingsDirty();
        StartMinimizedCheck.Unchecked += (_, _) => MarkSettingsDirty();
    }

    private void MarkSettingsDirty()
    {
        if (_suppressSettingsDirty || !IsLoaded) return;

        _saveStatusTimer?.Stop();
        SettingsStatusText.Foreground = BrushFromHex("#8A6315");
        SettingsStatusText.Text = "Alterações não salvas";
        SettingsStatusText.Visibility = Visibility.Visible;
        SaveSettingsButton.Content = "Salvar alterações";
    }

    private void SelectPaperWidth(string paperWidth)
    {
        SettingsPaperWidthCombo.SelectedItem = SettingsPaperWidthCombo.Items.OfType<ComboBoxItem>().FirstOrDefault(item => item.Tag?.ToString() == paperWidth)
            ?? SettingsPaperWidthCombo.Items.OfType<ComboBoxItem>().FirstOrDefault(item => item.Tag?.ToString() == "80");
    }

    private void SaveSettingsButton_Click(object sender, RoutedEventArgs e)
    {
        SaveSettingsButton.IsEnabled = false;
        SaveSettingsButton.Content = "Salvando...";
        try
        {
            if (SettingsPrinterCombo.SelectedItem is string printerName) _settings.SelectedPrinter = printerName;
            if (SettingsPaperWidthCombo.SelectedItem is ComboBoxItem paper) _settings.PaperWidth = paper.Tag?.ToString() is "58" or "80" ? paper.Tag.ToString()! : "80";
            _settings.PrintFontSize = ParseFontSize(SettingsFontSizeText.Text);
            _settings.MarginLeft = ParseMargin(SettingsMarginLeftText.Text);
            _settings.MarginRight = ParseMargin(SettingsMarginRightText.Text);
            _settings.MarginTop = ParseMargin(SettingsMarginTopText.Text);
            _settings.MarginBottom = ParseMargin(SettingsMarginBottomText.Text);
            _settings.PrintMargin = _settings.MarginLeft.Value;
            _settings.StartWithWindows = StartWithWindowsCheck.IsChecked == true;
            _settings.StartMinimized = StartMinimizedCheck.IsChecked == true;
            _settings.Save();
            ApplyStartupSetting();
            SettingsStatusText.Foreground = BrushFromHex("#2A8A78");
            SettingsStatusText.Text = $"Salvo às {DateTime.Now:HH:mm:ss} · fonte {_settings.PrintFontSize} · margens {_settings.MarginLeft}/{_settings.MarginRight}/{_settings.MarginTop}/{_settings.MarginBottom} mm";
            SettingsStatusText.Visibility = Visibility.Visible;
            _saveStatusTimer?.Stop();
            _saveStatusTimer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromSeconds(4) };
            _saveStatusTimer.Tick += (_, _) =>
            {
                _saveStatusTimer.Stop();
                SettingsStatusText.Visibility = Visibility.Collapsed;
            };
            _saveStatusTimer.Start();
        }
        catch (Exception error)
        {
            AgentLog.Write(error);
            SettingsStatusText.Text = "Não foi possível salvar as configurações.";
            SettingsStatusText.Foreground = BrushFromHex("#B7475B");
            SettingsStatusText.Visibility = Visibility.Visible;
        }
        finally
        {
            SaveSettingsButton.Content = "Salvar configurações";
            SaveSettingsButton.IsEnabled = true;
        }
    }

    private void ApplyStartupSetting()
    {
        using var runKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: true)
            ?? Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
        const string valueName = "TokyoSushiPrintAgent";
        if (_settings.StartWithWindows && !string.IsNullOrWhiteSpace(Environment.ProcessPath))
        {
            runKey?.SetValue(valueName, $"\"{Environment.ProcessPath}\"");
        }
        else
        {
            runKey?.DeleteValue(valueName, throwOnMissingValue: false);
        }
    }

    private static int ParseMargin(string? value)
    {
        return int.TryParse(value, out var margin) ? Math.Clamp(margin, 0, 16) : 3;
    }

    private static int ParseFontSize(string? value)
    {
        return int.TryParse(value, out var size) ? Math.Clamp(size, 6, 14) : 9;
    }

    private int ResolveMargin(int? value) => Math.Clamp(value ?? _settings.PrintMargin, 0, 16);

    private static System.Windows.Media.Brush BrushFromHex(string hex) => (System.Windows.Media.Brush)new BrushConverter().ConvertFromString(hex)!;
}
