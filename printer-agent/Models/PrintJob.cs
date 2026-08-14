namespace TokyoSushi.PrintAgent.Models;

public sealed class PrintJob
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string OrderId { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? FinishedAt { get; set; }
    public string PrinterName { get; set; } = "";
    public string Status { get; set; } = "Na fila";
    public string Error { get; set; } = "";
    public PrintOrderRequest Request { get; set; } = new();
}
