using System.Windows;
using System.Windows.Threading;
using System.Threading;
using TokyoSushi.PrintAgent.Services;

namespace TokyoSushi.PrintAgent;

public partial class App : System.Windows.Application
{
    private Mutex? _singleInstanceMutex;

    public App()
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        const string mutexName = "Local\\TokyoSushi.PrintAgent.SingleInstance";
        _singleInstanceMutex = new Mutex(true, mutexName, out var createdNew);
        if (!createdNew)
        {
            System.Windows.MessageBox.Show("O Tokyo Print já está aberto neste computador.", "Tokyo Print", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        base.OnStartup(e);
        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try { _singleInstanceMutex?.ReleaseMutex(); } catch (ApplicationException) { }
        _singleInstanceMutex?.Dispose();
        base.OnExit(e);
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
