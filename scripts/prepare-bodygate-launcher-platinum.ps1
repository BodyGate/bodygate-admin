$ErrorActionPreference = "Stop"

$version = "1.1.0-platinum-rc1"
$root = "C:\BodyGate-Launcher-Platinum"
$src = Join-Path $root "src"
$releaseRoot = Join-Path $root "releases"
$publish = Join-Path $releaseRoot $version
$existingLauncher = "C:\bodygate-admin\launcher\BodyGateLauncher"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "BodyGate Platinum TEST.lnk"

Write-Host "`n=== BODYGATE LAUNCHER PLATINUM ===" -ForegroundColor Cyan
Write-Host "Questa procedura NON modifica il launcher operativo attuale." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $src -Force | Out-Null
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

if (Test-Path $publish) {
    $archive = "$publish.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item $publish $archive
    Write-Host "Release precedente archiviata: $archive" -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $publish -Force | Out-Null

$project = @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>BodyGate</AssemblyName>
    <RootNamespace>BodyGateLauncher</RootNamespace>
    <PlatformTarget>x64</PlatformTarget>
    <Version>1.1.0</Version>
    <AssemblyVersion>1.1.0.0</AssemblyVersion>
    <FileVersion>1.1.0.0</FileVersion>
    <InformationalVersion>1.1.0-platinum-rc1</InformationalVersion>
    <ApplicationIcon Condition="Exists('BodyGate.ico')">BodyGate.ico</ApplicationIcon>
  </PropertyGroup>
</Project>
'@

$program = @'
using System.Threading;

namespace BodyGateLauncher;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(
            initiallyOwned: true,
            name: "BodyGateLauncher.Platinum",
            createdNew: out var createdNew
        );

        if (!createdNew)
        {
            MessageBox.Show(
                "BodyGate Launcher è già aperto.",
                "BodyGate",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
'@

$form = @'
using System.Diagnostics;
using System.Net.Http;

namespace BodyGateLauncher;

public sealed class MainForm : Form
{
    private const string AppUrl = "http://127.0.0.1:3000";
    private const string ServerHealthUrl = "http://127.0.0.1:3000/api/health";
    private const string BridgeHealthUrl = "http://127.0.0.1:5050/status";
    private const string AdminTaskName = "BodyGate Admin";
    private const string BridgeTaskName = "BodyGate Bridge";
    private const string LogDirectory = @"C:\bodygate-admin\logs";

    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(3)
    };

    private readonly System.Windows.Forms.Timer _statusTimer = new()
    {
        Interval = 3000
    };

    private readonly Label _serverStatus = new();
    private readonly Label _bridgeStatus = new();
    private readonly Label _messageLabel = new();
    private readonly Button _startButton = new();
    private readonly Button _openButton = new();
    private readonly Button _restartButton = new();

    private bool _statusRefreshInProgress;

    public MainForm()
    {
        BuildInterface();

        _statusTimer.Tick += async (_, _) => await RefreshStatusesAsync();

        Shown += async (_, _) =>
        {
            WriteLog("Launcher Platinum avviato.");
            await RefreshStatusesAsync();
            _statusTimer.Start();
        };
    }

    private void BuildInterface()
    {
        Text = "BodyGate Launcher Platinum";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(820, 500);
        MinimumSize = new Size(820, 500);
        MaximumSize = new Size(820, 500);
        BackColor = Color.FromArgb(7, 7, 8);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);
        MaximizeBox = false;

        var title = new Label
        {
            Text = "BODYGATE",
            Font = new Font("Segoe UI", 28, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = true,
            Location = new Point(42, 28)
        };

        var subtitle = new Label
        {
            Text = "Platinum Operations Launcher · RC1",
            Font = new Font("Segoe UI", 11),
            ForeColor = Color.FromArgb(155, 155, 160),
            AutoSize = true,
            Location = new Point(46, 84)
        };

        var panel = new Panel
        {
            Location = new Point(42, 128),
            Size = new Size(736, 184),
            BackColor = Color.FromArgb(18, 18, 20)
        };

        var serverLabel = CreateServiceLabel("BodyGate Server", new Point(26, 30));
        var bridgeLabel = CreateServiceLabel("DNake Bridge", new Point(26, 98));

        ConfigureStatusLabel(_serverStatus, new Point(570, 33));
        ConfigureStatusLabel(_bridgeStatus, new Point(570, 101));

        panel.Controls.Add(serverLabel);
        panel.Controls.Add(_serverStatus);
        panel.Controls.Add(bridgeLabel);
        panel.Controls.Add(_bridgeStatus);

        ConfigureButton(
            _startButton,
            "Avvia / Ripristina",
            new Point(42, 342),
            Color.FromArgb(214, 34, 42),
            async (_, _) => await StartOrRecoverAsync()
        );

        ConfigureButton(
            _openButton,
            "Apri BodyGate",
            new Point(290, 342),
            Color.FromArgb(45, 45, 48),
            (_, _) => OpenBrowser()
        );

        ConfigureButton(
            _restartButton,
            "Riavvia servizi",
            new Point(538, 342),
            Color.FromArgb(45, 45, 48),
            async (_, _) => await RestartAllAsync()
        );

        _messageLabel.Text = "Verifica automatica ogni 3 secondi";
        _messageLabel.ForeColor = Color.FromArgb(145, 145, 150);
        _messageLabel.AutoSize = false;
        _messageLabel.TextAlign = ContentAlignment.MiddleLeft;
        _messageLabel.Location = new Point(44, 425);
        _messageLabel.Size = new Size(730, 32);

        Controls.Add(title);
        Controls.Add(subtitle);
        Controls.Add(panel);
        Controls.Add(_startButton);
        Controls.Add(_openButton);
        Controls.Add(_restartButton);
        Controls.Add(_messageLabel);
    }

    private static Label CreateServiceLabel(string text, Point location) =>
        new()
        {
            Text = text,
            Font = new Font("Segoe UI", 13, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = true,
            Location = location
        };

    private static void ConfigureStatusLabel(Label label, Point location)
    {
        label.Text = "VERIFICA...";
        label.Font = new Font("Segoe UI", 11, FontStyle.Bold);
        label.ForeColor = Color.Goldenrod;
        label.AutoSize = true;
        label.Location = location;
    }

    private static void ConfigureButton(
        Button button,
        string text,
        Point location,
        Color background,
        EventHandler clickHandler)
    {
        button.Text = text;
        button.Location = location;
        button.Size = new Size(200, 54);
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = 0;
        button.BackColor = background;
        button.ForeColor = Color.White;
        button.Font = new Font("Segoe UI", 11, FontStyle.Bold);
        button.Cursor = Cursors.Hand;
        button.Click += clickHandler;
    }

    private async Task StartOrRecoverAsync()
    {
        SetBusy(true, "Controllo dei servizi...");

        try
        {
            var serverOnline = await IsOnlineAsync(ServerHealthUrl);
            var bridgeOnline = await IsOnlineAsync(BridgeHealthUrl);

            UpdateStatus(_serverStatus, serverOnline);
            UpdateStatus(_bridgeStatus, bridgeOnline);

            if (!serverOnline)
            {
                SetMessage("Ripristino del task BodyGate Admin...");
                await RestartScheduledTaskAsync(AdminTaskName);
            }

            if (!bridgeOnline)
            {
                SetMessage("Ripristino del task BodyGate Bridge...");
                await RestartScheduledTaskAsync(BridgeTaskName);
            }

            SetMessage("Attendo che BodyGate torni operativo...");
            await WaitForServicesAsync();

            SetMessage("BodyGate e Bridge sono online.");
            OpenBrowser();
        }
        catch (Exception ex)
        {
            WriteLog($"ERRORE avvio/ripristino: {ex}");
            SetMessage("Ripristino non completato. Controllare il messaggio di errore.");

            MessageBox.Show(
                ex.Message,
                "Errore BodyGate",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
        finally
        {
            SetBusy(false);
            await RefreshStatusesAsync();
        }
    }

    private async Task RestartAllAsync()
    {
        var confirmation = MessageBox.Show(
            "Riavviare BodyGate Server e DNake Bridge?\n\n" +
            "Gli accessi potrebbero essere indisponibili per alcuni secondi.",
            "Conferma riavvio servizi",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2
        );

        if (confirmation != DialogResult.Yes)
            return;

        SetBusy(true, "Riavvio controllato dei servizi...");

        try
        {
            await RestartScheduledTaskAsync(AdminTaskName);
            await RestartScheduledTaskAsync(BridgeTaskName);
            await WaitForServicesAsync();

            SetMessage("Riavvio completato: tutti i servizi sono online.");
            WriteLog("Riavvio manuale di Admin e Bridge completato.");
        }
        catch (Exception ex)
        {
            WriteLog($"ERRORE riavvio servizi: {ex}");
            SetMessage("Riavvio non completato.");

            MessageBox.Show(
                ex.Message,
                "Errore riavvio servizi",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
        finally
        {
            SetBusy(false);
            await RefreshStatusesAsync();
        }
    }

    private static async Task RestartScheduledTaskAsync(string taskName)
    {
        WriteLog($"Riavvio richiesto per task: {taskName}");

        await RunSchtasksAsync(
            $"/End /TN \"{taskName}\"",
            allowFailure: true
        );

        await Task.Delay(1200);

        var result = await RunSchtasksAsync(
            $"/Run /TN \"{taskName}\"",
            allowFailure: false
        );

        WriteLog(
            $"Task {taskName} avviato. ExitCode={result.ExitCode}; " +
            $"Output={result.Output.Trim()}; Error={result.Error.Trim()}"
        );
    }

    private static async Task<CommandResult> RunSchtasksAsync(
        string arguments,
        bool allowFailure)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "schtasks.exe",
                Arguments = arguments,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            }
        };

        if (!process.Start())
            throw new InvalidOperationException("Impossibile avviare schtasks.exe.");

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));

        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch
            {
                // Ignora errori durante la chiusura del comando scaduto.
            }

            throw new TimeoutException(
                $"Il comando per il task non ha risposto entro 15 secondi: {arguments}"
            );
        }

        var result = new CommandResult(
            process.ExitCode,
            await outputTask,
            await errorTask
        );

        if (!allowFailure && result.ExitCode != 0)
        {
            var details = string.IsNullOrWhiteSpace(result.Error)
                ? result.Output
                : result.Error;

            throw new InvalidOperationException(
                $"Impossibile gestire il task pianificato. {details.Trim()}"
            );
        }

        return result;
    }

    private async Task WaitForServicesAsync()
    {
        for (var attempt = 1; attempt <= 75; attempt++)
        {
            var serverCheck = IsOnlineAsync(ServerHealthUrl);
            var bridgeCheck = IsOnlineAsync(BridgeHealthUrl);

            await Task.WhenAll(serverCheck, bridgeCheck);

            var serverOnline = await serverCheck;
            var bridgeOnline = await bridgeCheck;

            UpdateStatus(_serverStatus, serverOnline);
            UpdateStatus(_bridgeStatus, bridgeOnline);

            if (serverOnline && bridgeOnline)
            {
                WriteLog($"Servizi online dopo {attempt} secondi.");
                return;
            }

            await Task.Delay(1000);
        }

        var unavailable = new List<string>();

        if (!await IsOnlineAsync(ServerHealthUrl))
            unavailable.Add("BodyGate Server");

        if (!await IsOnlineAsync(BridgeHealthUrl))
            unavailable.Add("DNake Bridge");

        throw new TimeoutException(
            $"{string.Join(" e ", unavailable)} non risultano online entro 75 secondi."
        );
    }

    private async Task RefreshStatusesAsync()
    {
        if (_statusRefreshInProgress || IsDisposed || Disposing)
            return;

        _statusRefreshInProgress = true;

        try
        {
            var serverCheck = IsOnlineAsync(ServerHealthUrl);
            var bridgeCheck = IsOnlineAsync(BridgeHealthUrl);

            await Task.WhenAll(serverCheck, bridgeCheck);

            if (IsDisposed || Disposing)
                return;

            UpdateStatus(_serverStatus, await serverCheck);
            UpdateStatus(_bridgeStatus, await bridgeCheck);
        }
        finally
        {
            _statusRefreshInProgress = false;
        }
    }

    private async Task<bool> IsOnlineAsync(string url)
    {
        try
        {
            using var response = await _httpClient.GetAsync(
                url,
                HttpCompletionOption.ResponseHeadersRead
            );

            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static void UpdateStatus(Label label, bool online)
    {
        label.Text = online ? "ONLINE" : "OFFLINE";
        label.ForeColor = online ? Color.LightGreen : Color.IndianRed;
    }

    private static void OpenBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "msedge.exe",
                Arguments = AppUrl,
                UseShellExecute = true
            });
        }
        catch
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = AppUrl,
                UseShellExecute = true
            });
        }
    }

    private void SetBusy(bool busy, string? message = null)
    {
        _startButton.Enabled = !busy;
        _openButton.Enabled = !busy;
        _restartButton.Enabled = !busy;
        UseWaitCursor = busy;

        if (!string.IsNullOrWhiteSpace(message))
            SetMessage(message);
    }

    private void SetMessage(string message)
    {
        _messageLabel.Text = message;
        WriteLog(message);
    }

    private static void WriteLog(string message)
    {
        try
        {
            Directory.CreateDirectory(LogDirectory);

            var logFile = Path.Combine(
                LogDirectory,
                $"bodygate-launcher-{DateTime.Now:yyyyMMdd}.log"
            );

            File.AppendAllText(
                logFile,
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}"
            );
        }
        catch
        {
            // Il logging non deve bloccare il launcher.
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _statusTimer.Stop();
        _statusTimer.Dispose();
        _httpClient.Dispose();

        WriteLog("Launcher Platinum chiuso.");
        base.OnFormClosing(e);
    }

    private sealed record CommandResult(
        int ExitCode,
        string Output,
        string Error
    );
}
'@

Set-Content -Path (Join-Path $src "BodyGateLauncher.csproj") -Value $project -Encoding utf8
Set-Content -Path (Join-Path $src "Program.cs") -Value $program -Encoding utf8
Set-Content -Path (Join-Path $src "MainForm.cs") -Value $form -Encoding utf8

$iconSource = Join-Path $existingLauncher "BodyGate.ico"
if (Test-Path $iconSource) {
    Copy-Item $iconSource (Join-Path $src "BodyGate.ico") -Force
    Write-Host "Icona BodyGate copiata." -ForegroundColor Green
}

Write-Host "`n=== COMPILAZIONE RELEASE ===" -ForegroundColor Cyan

dotnet publish `
    (Join-Path $src "BodyGateLauncher.csproj") `
    -c Release `
    -r win-x64 `
    --self-contained false `
    -p:PublishSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $publish

$exe = Join-Path $publish "BodyGate.exe"

if (-not (Test-Path $exe)) {
    throw "Compilazione terminata senza produrre BodyGate.exe"
}

$hash = Get-FileHash $exe -Algorithm SHA256
$item = Get-Item $exe

$releaseInfo = @"
BodyGate Launcher Platinum
Version: $version
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Executable: $exe
Length: $($item.Length)
SHA256: $($hash.Hash)
Runtime: .NET 8 framework-dependent
Official tasks:
- BodyGate Admin
- BodyGate Bridge
"@

Set-Content `
    -Path (Join-Path $publish "release-info.txt") `
    -Value $releaseInfo `
    -Encoding utf8

Write-Host "`n=== CREAZIONE COLLEGAMENTO TEST ===" -ForegroundColor Cyan

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = $publish
$shortcut.IconLocation = "$exe,0"
$shortcut.Description = "BodyGate Launcher Platinum TEST $version"
$shortcut.Save()

Write-Host "`n=== OPERAZIONE COMPLETATA ===" -ForegroundColor Green
Write-Host "Release: $publish" -ForegroundColor Yellow
Write-Host "Eseguibile: $exe" -ForegroundColor Yellow
Write-Host "Collegamento TEST: $shortcutPath" -ForegroundColor Yellow
Write-Host "SHA256: $($hash.Hash)" -ForegroundColor Yellow
Write-Host "`nIl collegamento BodyGate originale NON è stato modificato." -ForegroundColor Green
