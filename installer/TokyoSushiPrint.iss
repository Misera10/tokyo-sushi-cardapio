#define MyAppName "Tokyo Print"
#define MyAppVersion "0.4.1"
#define MyAppPublisher "Estúdio Fernandes"
#define MyAppExeName "TokyoSushi.PrintAgent.exe"

[Setup]
AppId={{6B6A3D1B-5A0B-4F3A-9E5D-8F9A4C1B7D22}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://estudiofernandes.com.br
AppMutex=Local\TokyoSushi.PrintAgent.SingleInstance
DefaultDirName={localappdata}\Programs\Tokyo Sushi\Tokyo Print
DefaultGroupName=Tokyo Sushi
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=TokyoPrintSetup-v{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
Uninstallable=yes
SetupLogging=yes
CloseApplications=yes
CloseApplicationsFilter={#MyAppExeName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "..\printer-agent\publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Tokyo Print"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Tokyo Print"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "TokyoSushiPrintAgent"; ValueData: "{app}\{#MyAppExeName}"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir o Tokyo Print agora"; Flags: nowait postinstall skipifsilent
