using System.IO;

namespace TokyoSushi.PrintAgent.Services;

public static class AgentLog
{
    private static readonly object Sync = new();

    public static void Write(Exception error)
    {
        try
        {
            var directory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TokyoSushi", "PrintAgent");
            Directory.CreateDirectory(directory);
            lock (Sync)
            {
                File.AppendAllText(Path.Combine(directory, "agent.log"), $"{DateTime.Now:O} {error}\n\n");
            }
        }
        catch
        {
            // Logging must never become a second failure.
        }
    }
}
