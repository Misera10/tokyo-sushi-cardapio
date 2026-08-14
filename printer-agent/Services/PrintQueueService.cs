using System.Collections.ObjectModel;
using System.IO;
using System.Text.Json;
using TokyoSushi.PrintAgent.Models;

namespace TokyoSushi.PrintAgent.Services;

public sealed class PrintQueueService : IDisposable
{
    private readonly AgentSettings _settings;
    private readonly PrinterService _printerService;
    private readonly SemaphoreSlim _signal = new(0);
    private readonly CancellationTokenSource _cancellation = new();
    private readonly object _sync = new();
    private readonly string _path;
    private readonly ObservableCollection<PrintJob> _jobs = new();

    public ReadOnlyObservableCollection<PrintJob> Jobs { get; }
    public event EventHandler? JobsChanged;

    public PrintQueueService(AgentSettings settings, PrinterService printerService)
    {
        _settings = settings;
        _printerService = printerService;
        _path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokyoSushi", "PrintAgent", "jobs.json");
        Jobs = new ReadOnlyObservableCollection<PrintJob>(_jobs);
        Load();
        _ = WorkerAsync(_cancellation.Token);
    }

    public PrintJob Enqueue(PrintOrderRequest request)
    {
        var printer = _settings.SelectedPrinter;
        if (string.IsNullOrWhiteSpace(printer)) throw new InvalidOperationException("Nenhuma impressora padrão foi encontrada no Windows.");
        var job = new PrintJob
        {
            OrderId = request.OrderId,
            PrinterName = printer,
            Request = request,
            Status = "Na fila"
        };
        lock (_sync)
        {
            _jobs.Insert(0, job);
            Trim();
            Save();
        }
        RaiseChanged();
        _signal.Release();
        return job;
    }

    public IReadOnlyList<PrintJob> Snapshot()
    {
        lock (_sync) return _jobs.ToList();
    }

    public bool Retry(string id)
    {
        lock (_sync)
        {
            var job = _jobs.FirstOrDefault(item => item.Id == id);
            if (job is null || job.Status is "Imprimindo" or "Na fila") return false;
            job.Status = "Na fila";
            job.Error = "";
            job.FinishedAt = null;
            Save();
        }
        RaiseChanged();
        _signal.Release();
        return true;
    }

    private async Task WorkerAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await _signal.WaitAsync(cancellationToken);
                PrintJob? job;
                lock (_sync) job = _jobs.LastOrDefault(item => item.Status == "Na fila");
                if (job is null) continue;

                lock (_sync) { job.Status = "Imprimindo"; Save(); }
                RaiseChanged();
                try
                {
                    await Task.Run(() => _printerService.PrintOrder(job.PrinterName, job.Request), cancellationToken);
                    lock (_sync) { job.Status = "Concluído"; job.FinishedAt = DateTime.Now; Save(); }
                }
                catch (Exception error)
                {
                    AgentLog.Write(error);
                    lock (_sync) { job.Status = "Falhou"; job.Error = error.Message; job.FinishedAt = DateTime.Now; Save(); }
                }
                RaiseChanged();
            }
            catch (OperationCanceledException) { return; }
            catch (Exception error) { AgentLog.Write(error); }
        }
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_path)) return;
            var jobs = JsonSerializer.Deserialize<List<PrintJob>>(File.ReadAllText(_path)) ?? new();
            foreach (var job in jobs.Take(30))
            {
                if (job.Status is "Imprimindo" or "Na fila") job.Status = "Falhou";
                _jobs.Add(job);
            }
        }
        catch (Exception error) { AgentLog.Write(error); }
    }

    private void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        File.WriteAllText(_path, JsonSerializer.Serialize(_jobs, new JsonSerializerOptions { WriteIndented = true }));
    }

    private void Trim()
    {
        while (_jobs.Count > 30) _jobs.RemoveAt(_jobs.Count - 1);
    }

    private void RaiseChanged() => JobsChanged?.Invoke(this, EventArgs.Empty);

    public void Dispose()
    {
        _cancellation.Cancel();
        _signal.Release();
        _cancellation.Dispose();
        _signal.Dispose();
    }
}
