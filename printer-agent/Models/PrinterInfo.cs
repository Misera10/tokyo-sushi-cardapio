namespace TokyoSushi.PrintAgent.Models;

public sealed record PrinterInfo(string Name, string Port, string Status, bool IsDefault);
