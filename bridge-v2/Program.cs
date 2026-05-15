using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using TcpClass.Controller;

namespace BodyGateAccessBridge
{
    internal class Program
    {
        private static readonly string Version = "V3.4";

        private static readonly string ControllerIp = "192.168.1.251";
        private static readonly int ControllerPort = 8000;
        private static readonly byte DoorIndex = 0;

        private static readonly string BodyGateCheckUrl =
            "http://localhost:3000/api/access/check";

        private static readonly string BodyGateLogUrl =
            "http://localhost:3000/api/access/log";

        private static readonly int BadgeCooldownSeconds = 3;
        private static readonly int OpenDelayAfterBadgeMs = 500;

        private static readonly int OpenRetryCount = 3;
        private static readonly int OpenRetryDelayMs = 700;

        private static ClassTcpClientWorker? tcpNet;
        private static TTCPPullCommand? pullCommand;
        private static TTCPController? controller;

        private static readonly object controllerLock = new object();
        private static readonly object badgeLock = new object();

        private static string lastBadge = "";
        private static DateTime lastBadgeTime = DateTime.MinValue;

        private static readonly string LogDir =
            Path.Combine(AppContext.BaseDirectory, "logs");

        private static readonly string LogFile =
            Path.Combine(LogDir, "bridge.log");

        private static readonly HttpClient httpClient =
            new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(5)
            };

        static void Main(string[] args)
        {
            Log("====================================");
            Log("BodyGate Bridge " + Version + " avviato");
            Log("Controller: " + ControllerIp + ":" + ControllerPort);
            Log("Bridge HTTP: http://localhost:5050/open");
            Log("BodyGate Check API: " + BodyGateCheckUrl);
            Log("BodyGate Log API: " + BodyGateLogUrl);
            Log("Modalita: badge centralina -> verifica BodyGate -> apertura tornello -> log Supabase");
            Log("ACCESSO CONSENTITO solo con BodyGate allowed=true");
            Log("ACCESSO NEGATO se BodyGate allowed=false o API offline");
            Log("OpenDoor False gestito come WARNING tecnico");
            Log("Retry apertura solo se comando NON inviato");
            Log("====================================");

            InitController();
            StartHttpServer();

            while (true)
            {
                Thread.Sleep(1000);

                try
                {
                    bool connected =
                        tcpNet != null &&
                        tcpNet.IsConnectSuccess();

                    if (!connected)
                    {
                        Log("Watchdog: controller non connesso, tento riconnessione...");
                        InitController();
                    }
                }
                catch (Exception ex)
                {
                    Log("Errore watchdog: " + ex.Message);
                }
            }
        }

        private static void InitController()
        {
            lock (controllerLock)
            {
                try
                {
                    tcpNet = new ClassTcpClientWorker();
                    pullCommand = new TTCPPullCommand();

                    controller = new TTCPController(
                        tcpNet,
                        pullCommand
                    );

                    controller.OnEventHandler += Controller_OnEventHandler;

                    bool connected =
                        tcpNet.OpenIP(
                            ControllerIp,
                            ControllerPort
                        );

                    Log("Connessione controller: " + connected);
                }
                catch (Exception ex)
                {
                    Log("Errore InitController: " + ex.Message);
                }
            }
        }

        private static void Controller_OnEventHandler(
            RAcsEvent acsEvent,
            TTCPControllerBase sender
        )
        {
            try
            {
                string badge = acsEvent.Value;

                if (string.IsNullOrWhiteSpace(badge))
                    return;

                if (IsDuplicateBadge(badge))
                {
                    Log("Badge duplicato ignorato: " + badge);
                    return;
                }

                Log("================================");
                Log("BADGE CENTRALINA");
                Log("Badge: " + badge);
                Log("Reader: " + acsEvent.Reader);
                Log("Door: " + acsEvent.Door);
                Log("EventType: " + acsEvent.EventType);
                Log("Data/Ora evento: " + acsEvent.Datetime);
                Log("================================");

                BodyGateResult bodyGateResult =
                    CheckBodyGateAccess(badge);

                OpenResult openResult =
                    new OpenResult();

                if (!bodyGateResult.Allowed)
                {
                    Log("ACCESSO NEGATO DA BODYGATE: " + badge);
                    Log("Motivo: " + bodyGateResult.Reason);

                    SendAccessLog(
                        badge,
                        bodyGateResult,
                        acsEvent,
                        openResult
                    );

                    return;
                }

                Log("ACCESSO AUTORIZZATO DA BODYGATE: " + badge);
                Log("Attesa prima apertura: " + OpenDelayAfterBadgeMs + " ms");

                Thread.Sleep(OpenDelayAfterBadgeMs);

                openResult =
                    OpenTurnstileWithSafeRetry();

                if (openResult.HasTrueResult)
                {
                    Log("ACCESSO CONSENTITO - TORNELLO APERTO: " + badge);
                }
                else if (openResult.CommandSent)
                {
                    Log("ACCESSO CONSENTITO - WARNING TECNICO SDK OpenDoor=False: " + badge);
                    Log("Nota: BodyGate allowed=true e comando OpenDoor inviato una sola volta.");
                    Log("Nessun retry eseguito per evitare impulsi multipli al tornello.");
                }
                else
                {
                    Log("ACCESSO CONSENTITO DA BODYGATE MA COMANDO NON INVIATO: " + badge);
                    Log("WARNING: verificare connessione controller / SDK.");
                }

                SendAccessLog(
                    badge,
                    bodyGateResult,
                    acsEvent,
                    openResult
                );
            }
            catch (Exception ex)
            {
                Log("Errore evento badge: " + ex.Message);
            }
        }

        private static bool IsDuplicateBadge(string badge)
        {
            lock (badgeLock)
            {
                DateTime now = DateTime.Now;

                if (
                    badge == lastBadge &&
                    (now - lastBadgeTime).TotalSeconds < BadgeCooldownSeconds
                )
                {
                    return true;
                }

                lastBadge = badge;
                lastBadgeTime = now;

                return false;
            }
        }

        private static BodyGateResult CheckBodyGateAccess(string badge)
        {
            try
            {
                Log("Verifica BodyGate per badge: " + badge);

                string json =
                    "{\"badge\":\"" + EscapeJson(badge) + "\"}";

                using StringContent content =
                    new StringContent(
                        json,
                        Encoding.UTF8,
                        "application/json"
                    );

                HttpResponseMessage response =
                    httpClient
                        .PostAsync(BodyGateCheckUrl, content)
                        .GetAwaiter()
                        .GetResult();

                string body =
                    response.Content
                        .ReadAsStringAsync()
                        .GetAwaiter()
                        .GetResult();

                Log("Risposta BodyGate: " + body);

                if (!response.IsSuccessStatusCode)
                {
                    return new BodyGateResult
                    {
                        Allowed = false,
                        Reason = "HTTP status non valido: " + (int)response.StatusCode
                    };
                }

                BodyGateResult result =
                    new BodyGateResult();

                try
                {
                    using JsonDocument doc =
                        JsonDocument.Parse(body);

                    JsonElement root =
                        doc.RootElement;

                    if (
                        root.TryGetProperty("allowed", out JsonElement allowedElement) &&
                        allowedElement.ValueKind == JsonValueKind.True
                    )
                    {
                        result.Allowed = true;
                    }

                    if (
                        root.TryGetProperty("reason", out JsonElement reasonElement) &&
                        reasonElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.Reason =
                            reasonElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("customer_id", out JsonElement customerElement) &&
                        customerElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.CustomerId =
                            customerElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("badge_code", out JsonElement badgeCodeElement) &&
                        badgeCodeElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.BadgeCode =
                            badgeCodeElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("controller_code", out JsonElement controllerCodeElement) &&
                        controllerCodeElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.ControllerCode =
                            controllerCodeElement.GetString() ?? "";
                    }
                }
                catch
                {
                    result.Allowed =
                        body.Contains("\"allowed\":true");

                    result.Reason =
                        "Parsing JSON fallback";
                }

                if (string.IsNullOrWhiteSpace(result.Reason))
                {
                    result.Reason =
                        result.Allowed ? "Accesso consentito" : "Accesso negato";
                }

                if (string.IsNullOrWhiteSpace(result.ControllerCode))
                {
                    result.ControllerCode = badge;
                }

                return result;
            }
            catch (Exception ex)
            {
                Log("Errore chiamata BodyGate: " + ex.Message);
                Log("Fallback sicurezza: ACCESSO NEGATO");

                return new BodyGateResult
                {
                    Allowed = false,
                    Reason = "Errore chiamata BodyGate",
                    ControllerCode = badge
                };
            }
        }

        private static void SendAccessLog(
            string badge,
            BodyGateResult bodyGateResult,
            RAcsEvent acsEvent,
            OpenResult openResult
        )
        {
            try
            {
                bool openWarning =
                    openResult.CommandSent &&
                    !openResult.HasTrueResult;

                string customerIdValue =
                    string.IsNullOrWhiteSpace(bodyGateResult.CustomerId)
                        ? "null"
                        : "\"" + EscapeJson(bodyGateResult.CustomerId) + "\"";

                string badgeCodeValue =
                    string.IsNullOrWhiteSpace(bodyGateResult.BadgeCode)
                        ? "\"" + EscapeJson(badge) + "\""
                        : "\"" + EscapeJson(bodyGateResult.BadgeCode) + "\"";

                string controllerCodeValue =
                    string.IsNullOrWhiteSpace(bodyGateResult.ControllerCode)
                        ? "\"" + EscapeJson(badge) + "\""
                        : "\"" + EscapeJson(bodyGateResult.ControllerCode) + "\"";

                string json =
                    "{" +
                    "\"badge_code\":" + badgeCodeValue + "," +
                    "\"controller_code\":" + controllerCodeValue + "," +
                    "\"customer_id\":" + customerIdValue + "," +
                    "\"allowed\":" + bodyGateResult.Allowed.ToString().ToLower() + "," +
                    "\"reason\":\"" + EscapeJson(bodyGateResult.Reason) + "\"," +
                    "\"door\":" + acsEvent.Door + "," +
                    "\"reader\":" + acsEvent.Reader + "," +
                    "\"event_type\":" + acsEvent.EventType + "," +
                    "\"open_command_sent\":" + openResult.CommandSent.ToString().ToLower() + "," +
                    "\"open_sdk_result\":" + openResult.HasTrueResult.ToString().ToLower() + "," +
                    "\"open_warning\":" + openWarning.ToString().ToLower() + "," +
                    "\"controller_ip\":\"" + EscapeJson(ControllerIp) + "\"," +
                    "\"bridge_version\":\"" + EscapeJson(Version) + "\"" +
                    "}";

                using StringContent content =
                    new StringContent(
                        json,
                        Encoding.UTF8,
                        "application/json"
                    );

                HttpResponseMessage response =
                    httpClient
                        .PostAsync(BodyGateLogUrl, content)
                        .GetAwaiter()
                        .GetResult();

                string responseBody =
                    response.Content
                        .ReadAsStringAsync()
                        .GetAwaiter()
                        .GetResult();

                if (response.IsSuccessStatusCode)
                {
                    Log("Log accesso inviato a BodyGate: " + responseBody);
                }
                else
                {
                    Log("Errore invio log accesso. HTTP " + (int)response.StatusCode + ": " + responseBody);
                }
            }
            catch (Exception ex)
            {
                Log("Errore SendAccessLog: " + ex.Message);
            }
        }

        private static void StartHttpServer()
        {
            Thread thread = new Thread(() =>
            {
                try
                {
                    HttpListener listener =
                        new HttpListener();

                    listener.Prefixes.Add(
                        "http://localhost:5050/"
                    );

                    listener.Start();

                    Log("HTTP server avviato su http://localhost:5050/");

                    while (true)
                    {
                        HttpListenerContext context =
                            listener.GetContext();

                        ThreadPool.QueueUserWorkItem(_ =>
                        {
                            HandleRequest(context);
                        });
                    }
                }
                catch (Exception ex)
                {
                    Log("Errore HTTP server: " + ex.Message);
                }
            });

            thread.IsBackground = true;
            thread.Start();
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            try
            {
                string path =
                    context.Request.Url?.AbsolutePath.ToLower() ?? "";

                if (path == "/open")
                {
                    OpenResult result =
                        OpenTurnstileWithSafeRetry();

                    if (result.HasTrueResult)
                    {
                        WriteJson(
                            context,
                            "{\"ok\":true,\"opened\":true,\"warning\":false,\"message\":\"Tornello aperto\",\"version\":\"" + Version + "\"}"
                        );
                    }
                    else if (result.CommandSent)
                    {
                        WriteJson(
                            context,
                            "{\"ok\":true,\"opened\":true,\"warning\":true,\"message\":\"Comando OpenDoor inviato una sola volta. SDK False gestito come warning tecnico.\",\"version\":\"" + Version + "\"}"
                        );
                    }
                    else
                    {
                        WriteJson(
                            context,
                            "{\"ok\":false,\"opened\":false,\"warning\":true,\"message\":\"Comando OpenDoor non inviato. Controller non disponibile.\",\"version\":\"" + Version + "\"}"
                        );
                    }

                    return;
                }

                if (path == "/status")
                {
                    bool connected =
                        tcpNet != null &&
                        tcpNet.IsConnectSuccess();

                    WriteJson(
                        context,
                        "{\"ok\":true,\"connected\":" +
                        connected.ToString().ToLower() +
                        ",\"controllerIp\":\"" +
                        ControllerIp +
                        "\",\"controllerPort\":" +
                        ControllerPort +
                        ",\"bodyGateCheckApi\":\"" +
                        BodyGateCheckUrl +
                        "\",\"bodyGateLogApi\":\"" +
                        BodyGateLogUrl +
                        "\",\"version\":\"" +
                        Version +
                        "\"}"
                    );

                    return;
                }

                if (path == "/health")
                {
                    WriteJson(
                        context,
                        "{\"ok\":true,\"service\":\"BodyGateBridge\",\"version\":\"" + Version + "\"}"
                    );

                    return;
                }

                WriteJson(
                    context,
                    "{\"ok\":false,\"message\":\"Endpoint non valido\",\"version\":\"" + Version + "\"}",
                    404
                );
            }
            catch (Exception ex)
            {
                Log("Errore request: " + ex.Message);

                try
                {
                    WriteJson(
                        context,
                        "{\"ok\":false,\"message\":\"Errore interno bridge\",\"version\":\"" + Version + "\"}",
                        500
                    );
                }
                catch
                {
                }
            }
        }

        private static OpenResult OpenTurnstileWithSafeRetry()
        {
            OpenResult finalResult =
                new OpenResult();

            for (int attempt = 1; attempt <= OpenRetryCount; attempt++)
            {
                Log("Tentativo apertura " + attempt + "/" + OpenRetryCount);

                OpenAttemptResult attemptResult =
                    OpenTurnstileOnce();

                if (attemptResult.CommandSent)
                {
                    finalResult.CommandSent = true;

                    if (attemptResult.SdkResult)
                    {
                        finalResult.HasTrueResult = true;
                        Log("Apertura riuscita al tentativo " + attempt);
                        return finalResult;
                    }

                    Log("WARNING tecnico: OpenDoor ha restituito False al tentativo " + attempt);
                    Log("Comando OpenDoor inviato. Stop retry per evitare impulsi multipli.");
                    LogControllerErrors();

                    return finalResult;
                }

                Log("Comando OpenDoor NON inviato al tentativo " + attempt);
                LogControllerErrors();

                if (attempt < OpenRetryCount)
                {
                    Log("Retry consentito perche il comando non e stato inviato.");
                    Thread.Sleep(OpenRetryDelayMs);
                }
            }

            Log("WARNING tecnico finale: nessun comando OpenDoor inviato dopo retry.");

            return finalResult;
        }

        private static OpenAttemptResult OpenTurnstileOnce()
        {
            try
            {
                bool connected =
                    tcpNet != null &&
                    tcpNet.IsConnectSuccess();

                if (
                    tcpNet == null ||
                    controller == null ||
                    !connected
                )
                {
                    Log("Controller non connesso. Riconnessione controller...");

                    InitController();

                    Thread.Sleep(500);
                }

                if (controller == null)
                {
                    Log("Controller non disponibile");
                    return new OpenAttemptResult
                    {
                        CommandSent = false,
                        SdkResult = false
                    };
                }

                bool connectedAfterReconnect =
                    tcpNet != null &&
                    tcpNet.IsConnectSuccess();

                if (!connectedAfterReconnect)
                {
                    Log("Controller ancora non connesso dopo riconnessione.");
                    return new OpenAttemptResult
                    {
                        CommandSent = false,
                        SdkResult = false
                    };
                }

                Log("Invio OpenDoor...");

                bool opened =
                    controller.OpenDoor(DoorIndex);

                Log("Risultato OpenDoor SDK: " + opened);

                return new OpenAttemptResult
                {
                    CommandSent = true,
                    SdkResult = opened
                };
            }
            catch (Exception ex)
            {
                Log("Errore OpenDoor: " + ex.Message);

                return new OpenAttemptResult
                {
                    CommandSent = false,
                    SdkResult = false
                };
            }
        }

        private static void LogControllerErrors()
        {
            try
            {
                if (tcpNet != null)
                {
                    Log("LastError tcpNet: " + tcpNet.LastError());
                }

                if (controller != null)
                {
                    Log("LastError controller: " + controller.LastError());
                }
            }
            catch (Exception ex)
            {
                Log("Errore lettura LastError: " + ex.Message);
            }
        }

        private static void WriteJson(
            HttpListenerContext context,
            string json,
            int statusCode = 200
        )
        {
            byte[] buffer =
                Encoding.UTF8.GetBytes(json);

            context.Response.StatusCode =
                statusCode;

            context.Response.ContentType =
                "application/json";

            context.Response.ContentLength64 =
                buffer.Length;

            context.Response.OutputStream.Write(
                buffer,
                0,
                buffer.Length
            );

            context.Response.OutputStream.Close();
        }

        private static string EscapeJson(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"");
        }

        private static void Log(string message)
        {
            try
            {
                Directory.CreateDirectory(LogDir);

                string line =
                    $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";

                Console.WriteLine(line);

                File.AppendAllText(
                    LogFile,
                    line + Environment.NewLine
                );
            }
            catch
            {
            }
        }

        private class BodyGateResult
        {
            public bool Allowed { get; set; }
            public string Reason { get; set; } = "";
            public string CustomerId { get; set; } = "";
            public string BadgeCode { get; set; } = "";
            public string ControllerCode { get; set; } = "";
        }

        private class OpenAttemptResult
        {
            public bool CommandSent { get; set; }
            public bool SdkResult { get; set; }
        }

        private class OpenResult
        {
            public bool CommandSent { get; set; }
            public bool HasTrueResult { get; set; }
        }
    }
}