using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.Data.Sqlite;

namespace BodyGateAccessBridge
{
    internal class Program
    {
        private static readonly string Version = "V3.9-DNAKE-SQL-QR-PRODUCTION";
        private static readonly bool DebugMode =
            Environment.GetEnvironmentVariable("BODYGATE_BRIDGE_DEBUG") == "1";

        private static readonly string ControllerIp = "192.168.1.251";
        private static readonly string ControllerUser = "admin";
        private static readonly string ControllerPassword = "888888";
        private static readonly byte DoorIndex = 0;

        private static readonly string DnakeIp = "192.168.1.22";
        private static readonly string DnakeUser = "admin";
        private static readonly string DnakePassword = "888888";
        private static readonly string DnakeDbUrl = "http://192.168.1.22/data/unlock_sql.db";

        private static readonly string BodyGateCheckUrl =
            "http://127.0.0.1:3000/api/access/check";

        private static readonly string BodyGateLogUrl =
            "http://127.0.0.1:3000/api/access/log";

        private static readonly string BodyGateMachineKey =
            Environment.GetEnvironmentVariable("BODYGATE_MACHINE_KEY")?.Trim() ?? "";

        private static readonly int PollIntervalMs = 200;
        private static readonly int BadgeCooldownSeconds = 3;
        private static readonly int OpenDelayAfterBadgeMs = 50;

        private static readonly object badgeLock = new object();
        private static readonly object pollLock = new object();

        private static string lastProcessedEventKey = "";
        private static string lastBadge = "";
        private static DateTime lastBadgeTime = DateTime.MinValue;
        private static bool isProcessingBadge = false;
        private static bool pollingStarted = false;

        private static readonly string WorkDir =
            Path.Combine(AppContext.BaseDirectory, "dnake-db");

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
            Directory.CreateDirectory(LogDir);
            Directory.CreateDirectory(WorkDir);

            Log("====================================");
            Log("BodyGate Bridge " + Version + " avviato");
            Log("Modalita lettura badge: DNake SQLite polling");
            Log("DNake DB: " + DnakeDbUrl);
            Log("Controller KT02.3 HTTP: http://" + ControllerIp + "/cdor.cgi?open=0");
            Log("Bridge HTTP: http://localhost:5050/open, /open0, /open1, /openlong0, /openlong1");
            Log("BodyGate Check API: " + BodyGateCheckUrl);
            Log("BodyGate Log API: " + BodyGateLogUrl);
            Log("Polling ottimizzato: " + PollIntervalMs + " ms");
            Log("Delay apertura ottimizzato: " + OpenDelayAfterBadgeMs + " ms");
            Log("ACCESSO CONSENTITO solo con BodyGate allowed=true");
            Log("ACCESSO NEGATO se BodyGate allowed=false o API offline");
            Log("TCP SDK disattivato. Wiegand non necessario.");
            Log("====================================");

            StartDnakeSqlPolling();
            StartHttpServer();

            while (true)
            {
                Thread.Sleep(1000);
            }
        }

        private static void AddBodyGateMachineAuth(HttpRequestMessage request)
        {
            if (!string.IsNullOrWhiteSpace(BodyGateMachineKey))
            {
                request.Headers.TryAddWithoutValidation(
                    "x-bodygate-machine-key",
                    BodyGateMachineKey
                );
            }
        }

        private static void StartDnakeSqlPolling()
        {
            if (pollingStarted)
            {
                return;
            }

            pollingStarted = true;

            Thread thread = new Thread(() =>
            {
                Log("Polling DNake SQLite avviato ogni " + PollIntervalMs + " ms");

                bool baselineLoaded = false;

                while (true)
                {
                    try
                    {
                        DnakeUnlockEvent? latestEvent = ReadLatestDnakeEvent();

                        if (latestEvent == null)
                        {
                            Thread.Sleep(PollIntervalMs);
                            continue;
                        }

                        if (!baselineLoaded)
                        {
                            lastProcessedEventKey = latestEvent.EventKey;
                            baselineLoaded = true;
                            Log("Baseline DNake caricata. In attesa di nuovi accessi...");
                            DebugLog("Baseline eventKey=" + latestEvent.EventKey + " credential=" + latestEvent.Number + " time=" + latestEvent.TimeText);
                            Thread.Sleep(PollIntervalMs);
                            continue;
                        }

                        if (latestEvent.EventKey != lastProcessedEventKey)
                        {
                            lastProcessedEventKey = latestEvent.EventKey;
                            ProcessBadgeFromDnakeSql(latestEvent);
                        }
                    }
                    catch (Exception ex)
                    {
                        Log("Errore polling DNake SQLite: " + ex.Message);
                    }

                    Thread.Sleep(PollIntervalMs);
                }
            });

            thread.IsBackground = true;
            thread.Start();
        }

        private static DnakeUnlockEvent? ReadLatestDnakeEvent()
        {
            lock (pollLock)
            {
                string tempPath = Path.Combine(
                    WorkDir,
                    "unlock_sql_" + DateTime.Now.Ticks + ".db"
                );

                try
                {
                    DownloadDnakeDb(tempPath);

                    using SqliteConnection connection = new SqliteConnection(
                        "Data Source=" + tempPath + ";Mode=ReadOnly"
                    );

                    connection.Open();

                    using SqliteCommand command = connection.CreateCommand();
                    command.CommandText =
                        "SELECT " +
                        "COALESCE(number, '') AS number, " +
                        "COALESCE(time, '') AS time_text, " +
                        "COALESCE(time_sec, 0) AS time_sec, " +
                        "COALESCE(id, 0) AS id, " +
                        "COALESCE(unlock_type, '') AS unlock_type, " +
                        "COALESCE(status, '') AS status, " +
                        "COALESCE(name, '') AS name " +
                        "FROM unlock_info " +
                        "WHERE " +
                        "(" +
                        "number IS NOT NULL AND TRIM(CAST(number AS TEXT)) <> ''" +
                        ") " +
                        "OR " +
                        "(" +
                        "CAST(unlock_type AS TEXT) = '6' " +
                        "AND id IS NOT NULL " +
                        "AND CAST(id AS INTEGER) > 0" +
                        ") " +
                        "OR " +
                        "(" +
                        "CAST(unlock_type AS TEXT) = '5' " +
                        "AND name IS NOT NULL " +
                        "AND TRIM(CAST(name AS TEXT)) <> ''" +
                        ") " +
                        "ORDER BY time_sec DESC, id DESC " +
                        "LIMIT 1";

                    using SqliteDataReader reader = command.ExecuteReader();

                    if (!reader.Read())
                    {
                        return null;
                    }

                    string number = Convert.ToString(reader["number"])?.Trim() ?? "";
                    string timeText = Convert.ToString(reader["time_text"])?.Trim() ?? "";
                    long timeSec = Convert.ToInt64(reader["time_sec"]);
                    long id = Convert.ToInt64(reader["id"]);
                    string unlockType = Convert.ToString(reader["unlock_type"])?.Trim() ?? "";
                    string status = Convert.ToString(reader["status"])?.Trim() ?? "";
                    string name = Convert.ToString(reader["name"])?.Trim() ?? "";

                    string credentialCode = number;

                    if (
                        string.IsNullOrWhiteSpace(credentialCode) &&
                        unlockType == "6" &&
                        id > 0
                    )
                    {
                        credentialCode = id.ToString();
                    }

                    if (
                        string.IsNullOrWhiteSpace(credentialCode) &&
                        unlockType == "5" &&
                        !string.IsNullOrWhiteSpace(name)
                    )
                    {
                        credentialCode = "mobile:" + name;
                    }

                    if (string.IsNullOrWhiteSpace(credentialCode))
                    {
                        return null;
                    }

                    return new DnakeUnlockEvent
                    {
                        Number = credentialCode,
                        RawNumber = number,
                        TimeText = timeText,
                        TimeSec = timeSec,
                        Id = id,
                        Name = name,
                        UnlockType = unlockType,
                        Status = status,
                        EventKey = timeSec + ":" + id + ":" + unlockType + ":" + credentialCode
                    };
                }
                finally
                {
                    try
                    {
                        if (File.Exists(tempPath))
                        {
                            File.Delete(tempPath);
                        }
                    }
                    catch
                    {
                    }
                }
            }
        }

        private static void DownloadDnakeDb(string destinationPath)
        {
            using HttpRequestMessage request = new HttpRequestMessage(
                HttpMethod.Get,
                DnakeDbUrl
            );

            string credentials = Convert.ToBase64String(
                Encoding.ASCII.GetBytes(DnakeUser + ":" + DnakePassword)
            );

            request.Headers.Authorization =
                new AuthenticationHeaderValue("Basic", credentials);

            using HttpResponseMessage response = httpClient.Send(request);

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception("Download DNake DB fallito: HTTP " + (int)response.StatusCode + " " + response.ReasonPhrase);
            }

            byte[] bytes = response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();

            if (bytes.Length < 100)
            {
                throw new Exception("Download DNake DB troppo piccolo: " + bytes.Length + " bytes");
            }

            File.WriteAllBytes(destinationPath, bytes);
        }

        private static void ProcessBadgeFromDnakeSql(DnakeUnlockEvent dnakeEvent)
        {
            string badge = dnakeEvent.Number.Trim();
            string accessType = dnakeEvent.IsMobile ? "MOBILE IPHONE / WALLET" : (dnakeEvent.IsQr ? "QR" : "RFID");

            if (string.IsNullOrWhiteSpace(badge))
            {
                return;
            }

            lock (badgeLock)
            {
                if (
                    badge == lastBadge &&
                    (DateTime.Now - lastBadgeTime).TotalSeconds < BadgeCooldownSeconds
                )
                {
                    DebugLog("Credenziale duplicata ignorata per cooldown: " + badge);
                    return;
                }

                if (isProcessingBadge)
                {
                    DebugLog("Credenziale ignorata: elaborazione in corso");
                    return;
                }

                lastBadge = badge;
                lastBadgeTime = DateTime.Now;
                isProcessingBadge = true;
            }

            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    Log("");
                    Log("ACCESSO " + accessType + " rilevato");
                    Log("Codice: " + badge);

                    DebugLog("Evento DNake key=" + dnakeEvent.EventKey);
                    DebugLog("Time DNake=" + dnakeEvent.TimeText);
                    DebugLog("UnlockType=" + dnakeEvent.UnlockType);
                    DebugLog("DNake UserId/Id=" + dnakeEvent.Id);
                    DebugLog("Number raw=" + dnakeEvent.RawNumber);
                    DebugLog("Name=" + dnakeEvent.Name);
                    DebugLog("Status=" + dnakeEvent.Status);

                    if (dnakeEvent.IsMobile)
                    {
                        Log("DNake mobile rilevato: " + dnakeEvent.Name);
                        Log("Evento unlock_type=5 intercettato correttamente.");
                        Log("TEST SICURO: nessuna chiamata a BodyGate e nessuna apertura tornello per eventi mobile in questa versione.");
                        return;
                    }

                    BodyGateResult bodyGateResult =
                        CheckBodyGateAccess(badge);

                    OpenResult openResult = new OpenResult();

                    string displayName = string.IsNullOrWhiteSpace(bodyGateResult.CustomerName)
                        ? "Cliente non identificato"
                        : bodyGateResult.CustomerName;

                    if (bodyGateResult.EntityType == "staff")
                    {
                        Log("Staff: " + displayName);
                    }
                    else
                    {
                        Log("Cliente: " + displayName);
                    }

                    if (!bodyGateResult.Allowed)
                    {
                        Log("ESITO: NEGATO");
                        Log("Motivo: " + bodyGateResult.Reason);

                        SendAccessLog(
                            badge,
                            bodyGateResult,
                            dnakeEvent,
                            openResult
                        );

                        return;
                    }

                    Log("ESITO: CONSENTITO");

                    if (OpenDelayAfterBadgeMs > 0)
                    {
                        Thread.Sleep(OpenDelayAfterBadgeMs);
                    }

                    openResult = OpenTurnstileHttp(DoorIndex);

                    if (openResult.Opened)
                    {
                        Log("TORNELLO APERTO");
                    }
                    else
                    {
                        Log("ERRORE APERTURA TORNELLO");
                        Log("Dettaglio: " + openResult.Message);
                    }

                    SendAccessLog(
                        badge,
                        bodyGateResult,
                        dnakeEvent,
                        openResult
                    );
                }
                catch (Exception ex)
                {
                    Log("Errore gestione accesso " + accessType + ": " + ex.Message);
                }
                finally
                {
                    lock (badgeLock)
                    {
                        isProcessingBadge = false;
                    }
                }
            });
        }

        private static BodyGateResult CheckBodyGateAccess(string badge)
        {
            try
            {
                string json =
                    "{" +
                    "\"badge\":\"" + EscapeJson(badge) + "\"," +
                    "\"badge_code\":\"" + EscapeJson(badge) + "\"," +
                    "\"source\":\"dnake-sql\"" +
                    "}";

                using StringContent content = new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json"
                );

                using HttpRequestMessage request =
                    new HttpRequestMessage(HttpMethod.Post, BodyGateCheckUrl)
                    {
                        Content = content
                    };

                AddBodyGateMachineAuth(request);

                using HttpResponseMessage response =
                    httpClient.Send(request);

                string body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                DebugLog("Risposta BodyGate: " + body);

                BodyGateResult result = new BodyGateResult
                {
                    Allowed = false,
                    Reason = "Accesso negato",
                    BadgeCode = badge,
                    ControllerCode = badge
                };

                try
                {
                    using JsonDocument doc = JsonDocument.Parse(body);
                    JsonElement root = doc.RootElement;

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
                        result.Reason = reasonElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("entity_type", out JsonElement entityTypeElement) &&
                        entityTypeElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.EntityType = entityTypeElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("customer_id", out JsonElement customerElement) &&
                        customerElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.CustomerId = customerElement.GetString() ?? "";
                    }

                    if (
                        root.TryGetProperty("badge_code", out JsonElement badgeCodeElement) &&
                        badgeCodeElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.BadgeCode = badgeCodeElement.GetString() ?? badge;
                    }

                    if (
                        root.TryGetProperty("controller_code", out JsonElement controllerCodeElement) &&
                        controllerCodeElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.ControllerCode = controllerCodeElement.GetString() ?? badge;
                    }

                    if (
                        root.TryGetProperty("customer_name", out JsonElement customerNameElement) &&
                        customerNameElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.CustomerName = customerNameElement.GetString() ?? "";
                    }

                    if (
                        string.IsNullOrWhiteSpace(result.CustomerName) &&
                        root.TryGetProperty("staff_name", out JsonElement staffNameElement) &&
                        staffNameElement.ValueKind == JsonValueKind.String
                    )
                    {
                        result.CustomerName = staffNameElement.GetString() ?? "";
                    }
                }
                catch
                {
                    result.Allowed = body.Contains("\"allowed\":true");
                    result.Reason = "Parsing JSON fallback";
                }

                if (string.IsNullOrWhiteSpace(result.Reason))
                {
                    result.Reason = result.Allowed ? "Accesso consentito" : "Accesso negato";
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
                    BadgeCode = badge,
                    ControllerCode = badge
                };
            }
        }

        private static OpenResult OpenTurnstileHttp(byte doorIndex)
        {
            try
            {
                string openUrl = "http://" + ControllerIp + "/cdor.cgi?open=0";

                using HttpRequestMessage request = new HttpRequestMessage(
                    HttpMethod.Get,
                    openUrl
                );

                string credentials = Convert.ToBase64String(
                    Encoding.ASCII.GetBytes(ControllerUser + ":" + ControllerPassword)
                );

                request.Headers.Authorization =
                    new AuthenticationHeaderValue("Basic", credentials);

                using HttpResponseMessage response = httpClient.Send(request);
                string text = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                bool ok = response.IsSuccessStatusCode;

                DebugLog("Apertura KT02.3 HTTP status=" + (int)response.StatusCode + " response=" + text);

                return new OpenResult
                {
                    CommandSent = true,
                    Opened = ok,
                    Door = doorIndex,
                    Message = ok ? "Tornello aperto via HTTP KT02.3" : "HTTP " + (int)response.StatusCode + " " + text
                };
            }
            catch (Exception ex)
            {
                Log("Errore apertura HTTP KT02.3: " + ex.Message);

                return new OpenResult
                {
                    CommandSent = true,
                    Opened = false,
                    Door = doorIndex,
                    Message = ex.Message
                };
            }
        }

        private static void SendAccessLog(
            string badge,
            BodyGateResult bodyGateResult,
            DnakeUnlockEvent dnakeEvent,
            OpenResult openResult
        )
        {
            try
            {
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

                string resultValue = bodyGateResult.Allowed ? "allowed" : "denied";

                string json =
                    "{" +
                    "\"badge_code\":" + badgeCodeValue + "," +
                    "\"controller_code\":" + controllerCodeValue + "," +
                    "\"credential_code\":\"" + EscapeJson(badge) + "\"," +
                    "\"customer_id\":" + customerIdValue + "," +
                    "\"allowed\":" + bodyGateResult.Allowed.ToString().ToLower() + "," +
                    "\"result\":\"" + resultValue + "\"," +
                    "\"reason\":\"" + EscapeJson(bodyGateResult.Reason) + "\"," +
                    "\"door\":" + DoorIndex + "," +
                    "\"reader\":0," +
                    "\"event_type\":0," +
                    "\"open_command_sent\":" + openResult.CommandSent.ToString().ToLower() + "," +
                    "\"open_sdk_result\":" + openResult.Opened.ToString().ToLower() + "," +
                    "\"open_warning\":" + (bodyGateResult.Allowed && !openResult.Opened).ToString().ToLower() + "," +
                    "\"controller_ip\":\"" + EscapeJson(DnakeIp) + "\"," +
                    "\"bridge_version\":\"" + EscapeJson(Version) + "\"," +
                    "\"direction\":\"in\"" +
                    "}";

                using StringContent content = new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json"
                );

                using HttpRequestMessage request =
                    new HttpRequestMessage(HttpMethod.Post, BodyGateLogUrl)
                    {
                        Content = content
                    };

                AddBodyGateMachineAuth(request);

                using HttpResponseMessage response =
                    httpClient.Send(request);

                string responseText = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                if (response.IsSuccessStatusCode)
                {
                    DebugLog("Log BodyGate status=" + (int)response.StatusCode + " response=" + responseText);
                }
                else
                {
                    Log("WARNING: log BodyGate non salvato. HTTP " + (int)response.StatusCode);
                    DebugLog("Risposta log BodyGate: " + responseText);
                }
            }
            catch (Exception ex)
            {
                Log("Errore invio log BodyGate: " + ex.Message);
            }
        }

        private static void StartHttpServer()
        {
            Thread thread = new Thread(() =>
            {
                try
                {
                    HttpListener listener = new HttpListener();

string[] prefixes =
{
    "http://127.0.0.1:5050/",
    "http://localhost:5050/"
};

Exception? lastError = null;
string activePrefix = "";

foreach (string prefix in prefixes)
{
    try
    {
        listener.Prefixes.Clear();
        listener.Prefixes.Add(prefix);
        listener.Start();

        activePrefix = prefix;
        Log("HTTP server avviato su " + activePrefix);
        break;
    }
    catch (Exception ex)
    {
        lastError = ex;
        Log("Tentativo HTTP server fallito su " + prefix + ": " + ex.Message);
    }
}

if (!listener.IsListening)
{
    throw new Exception(
        "Impossibile avviare HTTP server su 127.0.0.1:5050 o localhost:5050. Ultimo errore: " +
        (lastError?.Message ?? "errore sconosciuto")
    );
}

                    while (true)
                    {
                        HttpListenerContext context = listener.GetContext();

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
                string path = context.Request.Url?.AbsolutePath.ToLower() ?? "";

                if (path == "/open" || path == "/open0" || path == "/open-in")
                {
                    HandleOpenRequest(context, DoorIndex);
                    return;
                }

                if (path == "/open1" || path == "/open-out" || path == "/openlong0" || path == "/openlong1")
                {
                    HandleOpenRequest(context, DoorIndex);
                    return;
                }

                if (path == "/status")
                {
                    WriteJson(
                        context,
                        new
                        {
                            ok = true,
                            service = "BodyGateBridge",
                            version = Version,
                            mode = "dnake-sql-polling",
                            dnakeDbUrl = DnakeDbUrl,
                            controllerIp = ControllerIp,
                            pollingStarted,
                            lastBadge,
                            lastBadgeTime = lastBadgeTime.ToString("s"),
                            lastProcessedEventKey,
                            pollIntervalMs = PollIntervalMs,
                            openDelayAfterBadgeMs = OpenDelayAfterBadgeMs
                        }
                    );

                    return;
                }

                if (path == "/health")
                {
                    WriteJson(
                        context,
                        new
                        {
                            ok = true,
                            service = "BodyGateBridge",
                            version = Version
                        }
                    );

                    return;
                }

                WriteJson(
                    context,
                    new
                    {
                        ok = false,
                        message = "Endpoint non valido",
                        version = Version
                    },
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
                        new
                        {
                            ok = false,
                            message = "Errore interno bridge",
                            error = ex.Message,
                            version = Version
                        },
                        500
                    );
                }
                catch
                {
                }
            }
        }

        private static void HandleOpenRequest(HttpListenerContext context, byte doorIndex)
        {
            OpenResult result = OpenTurnstileHttp(doorIndex);

            WriteJson(
                context,
                new
                {
                    ok = result.Opened,
                    opened = result.Opened,
                    warning = false,
                    door = doorIndex,
                    command = "KT02_HTTP",
                    message = result.Message,
                    version = Version
                }
            );
        }

        private static void WriteJson(
            HttpListenerContext context,
            object payload,
            int statusCode = 200
        )
        {
            string json = JsonSerializer.Serialize(payload);
            byte[] buffer = Encoding.UTF8.GetBytes(json);

            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json";
            context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
            context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
            context.Response.ContentLength64 = buffer.Length;
            context.Response.OutputStream.Write(buffer, 0, buffer.Length);
            context.Response.OutputStream.Close();
        }

        private static string EscapeJson(string value)
        {
            if (value == null)
            {
                return "";
            }

            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static void Log(string message)
        {
            string line =
                "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message;

            Console.WriteLine(line);

            try
            {
                Directory.CreateDirectory(LogDir);
                File.AppendAllText(LogFile, line + Environment.NewLine);
            }
            catch
            {
            }
        }

        private static void DebugLog(string message)
        {
            if (!DebugMode)
            {
                return;
            }

            Log("DEBUG: " + message);
        }

        private class DnakeUnlockEvent
        {
            public string Number { get; set; } = "";
            public string RawNumber { get; set; } = "";
            public string TimeText { get; set; } = "";
            public long TimeSec { get; set; }
            public long Id { get; set; }
            public string Name { get; set; } = "";
            public string UnlockType { get; set; } = "";
            public string Status { get; set; } = "";
            public string EventKey { get; set; } = "";

            public bool IsQr
            {
                get { return UnlockType == "6"; }
            }

            public bool IsMobile
            {
                get { return UnlockType == "5"; }
            }
        }

        private class BodyGateResult
        {
            public bool Allowed { get; set; }
            public string Reason { get; set; } = "";
            public string CustomerId { get; set; } = "";
            public string CustomerName { get; set; } = "";
            public string BadgeCode { get; set; } = "";
            public string ControllerCode { get; set; } = "";
            public string EntityType { get; set; } = "";
        }

        private class OpenResult
        {
            public bool CommandSent { get; set; }
            public bool Opened { get; set; }
            public byte Door { get; set; }
            public string Message { get; set; } = "";
        }
    }
}