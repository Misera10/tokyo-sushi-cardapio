using System.Windows;
using System.Windows.Threading;
using TokyoSushi.PrintAgent.Services;

namespace TokyoSushi.PrintAgent;

public partial class App : System.Windows.Application
{
    public App()
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;
    }

    private static void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs args)
    {
        AgentLog.Write(args.Exception);
        args.Handled = true;
    }

    private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs args)
    {
        if (args.ExceptionObject is Exception error) AgentLog.Write(error);
    }
}
