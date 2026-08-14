using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using TokyoSushi.PrintAgent.Models;

namespace TokyoSushi.PrintAgent.Services;

public sealed class LocalAgentServer : IDisposable
{
    private readonly AgentSettings _settings;
    private readonly PrinterService _printerService;
    private readonly PrintQueueService _queue;
    private readonly HttpListener _listener = new();
    private CancellationTokenSource? _cancellation;

    private static readonly HashSet<string> AllowedOrigins = new(StringComparer.OrdinalIgnoreCase)
    {
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://tokyosushi.estudiofernandes.com.br",
        "https://tokyo-sushi-7fu.pages.dev"
    };

    public LocalAgentServer(AgentSettings settings, PrinterService printerService, PrintQueueService queue)
    {
        _settings = settings;
        _printerService = printerService;
        _queue = queue;
        _listener.Prefixes.Add("http://127.0.0.1:4242/");
    }

    public void Start()
    {
        if (_listener.IsListening) return;
        _cancellation = new CancellationTokenSource();
        _listener.Start();
        _ = ListenAsync(_cancellation.Token);
    }

    private async Task ListenAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var context = await _listener.GetContextAsync().WaitAsync(cancellationToken);
                _ = Task.Run(() => HandleAsync(context), cancellationToken);
            }
            catch (OperationCanceledException) { return; }
            catch (HttpListenerException) { return; }
        }
    }

    private async Task HandleAsync(HttpListenerContext context)
    {
        var origin = context.Request.Headers["Origin"];
        if (AllowedOrigins.Contains(origin ?? ""))
        {
            context.Response.Headers["Access-Control-Allow-Origin"] = origin!;
            context.Response.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
            context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
            context.Response.Headers["Vary"] = "Origin";
        }

        if (context.Request.HttpMethod == "OPTIONS")
        {
            context.Response.StatusCode = 204;
            context.Response.Close();
            return;
        }

        try
        {
            if (context.Request.Url?.AbsolutePath == "/health")
            {
                await RespondAsync(context, 200, new { ok = true, app = "tokyo-print", version = "0.3.17" });
                return;
            }

            if (!IsAuthorized(context.Request))
            {
                await RespondAsync(context, 401, new { ok = false, error = "unauthorized" });
                return;
            }

            if (context.Request.HttpMethod == "GET" && context.Request.Url?.AbsolutePath == "/printers")
            {
                await RespondAsync(context, 200, new { ok = true, printers = _printerService.ListPrinters() });
                return;
            }

            if (context.Request.HttpMethod == "POST" && context.Request.Url?.AbsolutePath == "/v1/print-test")
            {
                var payload = await ReadJsonAsync<PrintTestRequest>(context.Request) ?? new PrintTestRequest();
                var printerName = payload.PrinterName ?? _settings.SelectedPrinter;
                if (string.IsNullOrWhiteSpace(printerName))
                {
                    await RespondAsync(context, 422, new { ok = false, error = "printer_required" });
                    return;
                }

                _printerService.PrintTest(
                    printerName,
                    _settings.PaperWidth,
                    _settings.PrintFontSize,
                    ResolveMargin(_settings.MarginLeft, _settings.PrintMargin),
                    ResolveMargin(_settings.MarginRight, _settings.PrintMargin),
                    ResolveMargin(_settings.MarginTop, _settings.PrintMargin),
                    ResolveMargin(_settings.MarginBottom, _settings.PrintMargin));
                await RespondAsync(context, 200, new { ok = true, printer = printerName });
                return;
            }

            if (context.Request.HttpMethod == "GET" && context.Request.Url?.AbsolutePath == "/v1/jobs")
            {
                await RespondAsync(context, 200, new { ok = true, jobs = _queue.Snapshot() });
                return;
            }

            if (context.Request.HttpMethod == "POST" && context.Request.Url?.AbsolutePath == "/v1/print-order")
            {
                var request = await ReadJsonAsync<PrintOrderRequest>(context.Request);
                if (request is null || request.Items.Count == 0)
                {
                    await RespondAsync(context, 422, new { ok = false, error = "order_items_required" });
                    return;
                }

                request.OrderId = string.IsNullOrWhiteSpace(request.OrderId) ? $"LOCAL-{DateTime.Now:yyyyMMddHHmmss}" : request.OrderId;
                ApplyLocalPrintSettings(request);
                var job = _queue.Enqueue(request);
                await RespondAsync(context, 202, new { ok = true, job });
                return;
            }

            if (context.Request.HttpMethod == "POST" && context.Request.Url?.AbsolutePath.StartsWith("/v1/jobs/", StringComparison.OrdinalIgnoreCase) == true)
            {
                var path = context.Request.Url.AbsolutePath.Trim('/').Split('/');
                if (path.Length == 4 && path[0] == "v1" && path[1] == "jobs" && path[3] == "retry" && _queue.Retry(path[2]))
                {
                    await RespondAsync(context, 202, new { ok = true, jobId = path[2] });
                    return;
                }

                await RespondAsync(context, 409, new { ok = false, error = "job_not_retryable" });
                return;
            }

            await RespondAsync(context, 404, new { ok = false, error = "not_found" });
        }
        catch (Exception error)
        {
            await RespondAsync(context, 500, new { ok = false, error = "print_failed", message = error.Message });
        }
    }

    private void ApplyLocalPrintSettings(PrintOrderRequest request)
    {
        request.PaperWidth = _settings.PaperWidth is "58" or "80" ? _settings.PaperWidth : "80";
        request.FontSize = Math.Clamp(_settings.PrintFontSize, 6, 14);
        request.MarginLeft = ResolveMargin(_settings.MarginLeft, _settings.PrintMargin);
        request.MarginRight = ResolveMargin(_settings.MarginRight, _settings.PrintMargin);
        request.MarginTop = ResolveMargin(_settings.MarginTop, _settings.PrintMargin);
        request.MarginBottom = ResolveMargin(_settings.MarginBottom, _settings.PrintMargin);
        request.Margin = request.MarginLeft;
    }

    private static int ResolveMargin(int? value, int fallback) => Math.Clamp(value ?? fallback, 0, 16);

    private bool IsAuthorized(HttpListenerRequest request)
    {
        var authorization = request.Headers["Authorization"] ?? "";
        if (authorization.Equals($"Bearer {_settings.ApiKey}", StringComparison.Ordinal)) return true;
        return AllowedOrigins.Contains(request.Headers["Origin"] ?? "");
    }

    private static async Task RespondAsync(HttpListenerContext context, int statusCode, object body)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(body));
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }

    private static async Task<T?> ReadJsonAsync<T>(HttpListenerRequest request)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        var body = await reader.ReadToEndAsync();
        return JsonSerializer.Deserialize<T>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public void Dispose()
    {
        _cancellation?.Cancel();
        if (_listener.IsListening) _listener.Stop();
        _listener.Close();
        _cancellation?.Dispose();
    }

    private sealed record PrintTestRequest(string? PrinterName = null, string? PaperWidth = null, int? Margin = null);
}
