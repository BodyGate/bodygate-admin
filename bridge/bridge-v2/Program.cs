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
        private static readonly string Version = "V3.9.4-ALERTS";
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

        private static readonly int PollIntervalMs = 100;
        private static readonly int BadgeCooldownSeconds = 3;
        private static readonly int OpenDelayAfterBadgeMs = 0;

        // Topic ntfy.sh casuale (128 bit): la riservatezza si basa sull'essere
        // impossibile da indovinare, non su un login. Non va mai scritto nel
        // sorgente (il repository potrebbe essere pubblico): lo carica lo script
        // di avvio da .env.local (BODYGATE_NTFY_TOPIC), come la machine key.
        private static readonly string NtfyTopic =
            Environment.GetEnvironmentVariable("BODYGATE_NTFY_TOPIC")?.Trim() ?? "";
        private static readonly int OperatingHourStart = 7;
        private static readonly int OperatingHourEnd = 22;
        private static readonly int StaleAccessAlertMinutes = 90;
        private static readonly int PollDownAlertSeconds = 60;

        // Il mini_httpd del DNake consegna il file unlock_sql.db troncato quando
        // supera circa 284 KB (osservato: 290816 byte consegnati su 311296
        // dichiarati). Avviso in anticipo, prima di arrivarci.
        private static readonly long DbSizeWarnBytes = 250 * 1024;
        private static readonly int DownloadBodyTimeoutSeconds = 5;
        private static readonly int PollErrorLogIntervalSeconds = 30;
        private static readonly int MaxPollBackoffMs = 5000;
        private static readonly int PollHealthySeconds = 30;
        private static readonly TimeSpan PollStallTimeout = TimeSpan.FromSeconds(90);

        private static readonly object badgeLock = new object();
        private static readonly object pollLock = new object();

        private static string lastProcessedEventKey = "";
        private static string lastBadge = "";
        private static DateTime lastBadgeTime = DateTime.MinValue;
        private static bool isProcessingBadge = false;
        private static bool pollingStarted = false;

        // Questi campi sono toccati solo dal thread di polling in StartDnakeSqlPolling,
        // quindi non serve alcun lock.
        private static DateTime? firstPollFailureTime = null;
        private static bool dnakeDownAlertSent = false;
        private static bool staleAccessAlertSent = false;
        private static bool dbSizeWarnSent = false;
        private static string lastLoggedPollError = "";
        private static DateTime lastPollErrorLogTime = DateTime.MinValue;
        private static int suppressedPollErrors = 0;

        // Scritti dal thread di polling, letti da /status e dal controllo di stallo.
        private static readonly DateTime ProcessStartTime = DateTime.Now;
        private static DateTime lastPollHeartbeatUtc = DateTime.UtcNow;
        private static long lastSuccessfulPollTicks = 0;
        private static int consecutivePollFailures = 0;
        private static string lastPollError = "";
        private static long lastDbExpectedBytes = -1;
        private static long lastDbReceivedBytes = -1;

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
            Log(
                string.IsNullOrWhiteSpace(NtfyTopic)
                    ? "ATTENZIONE: BODYGATE_NTFY_TOPIC non configurato, alert ntfy DISATTIVATI."
                    : "Alert ntfy attivi."
            );
            Log("====================================");

            StartDnakeSqlPolling();
            StartHttpServer();

            while (true)
            {
                Thread.Sleep(1000);

                // Polling bloccato (es. lettura appesa): esco per far riavviare il
                // launcher invece di lasciare il bridge vivo ma sordo ai badge.
                if (
                    pollingStarted &&
                    DateTime.UtcNow - lastPollHeartbeatUtc > PollStallTimeout
                )
                {
                    Log("Polling DNake bloccato da oltre " + PollStallTimeout.TotalSeconds + "s, uscita per riavvio.");
                    Environment.Exit(1);
                }
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
                    lastPollHeartbeatUtc = DateTime.UtcNow;
                    int sleepMs = PollIntervalMs;

                    try
                    {
                        DnakeUnlockEvent? latestEvent = ReadLatestDnakeEvent();
                        NotifyPollSucceeded();

                        if (latestEvent == null)
                        {
                            Thread.Sleep(PollIntervalMs);
                            continue;
                        }

                        if (!baselineLoaded)
                        {
                            lastProcessedEventKey = latestEvent.EventKey;
                            baselineLoaded = true;
                            lock (badgeLock)
                            {
                                lastBadgeTime = DateTime.Now;
                            }
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
                        consecutivePollFailures++;
                        LogPollError(ex);
                        NotifyPollFailed(ex);

                        // Backoff: se il DNake non risponde correttamente inutile
                        // martellarlo ogni 100 ms. Riprova comunque all'infinito, cosi'
                        // il bridge riparte da solo appena il DNake torna a posto.
                        int backoffShift = Math.Min(consecutivePollFailures, 6);
                        sleepMs = Math.Min(MaxPollBackoffMs, PollIntervalMs * (1 << backoffShift));
                    }

                    CheckStaleAccessAlert();

                    Thread.Sleep(sleepMs);
                }
            });

            thread.IsBackground = true;
            thread.Start();
        }

        private static void NotifyPollSucceeded()
        {
            int previousFailures = consecutivePollFailures;

            consecutivePollFailures = 0;
            System.Threading.Interlocked.Exchange(ref lastSuccessfulPollTicks, DateTime.Now.Ticks);

            if (previousFailures > 0)
            {
                Log("Polling DNake ripreso dopo " + previousFailures + " errori consecutivi.");
            }

            CheckDbSizeWarning();

            if (firstPollFailureTime == null)
            {
                return;
            }

            firstPollFailureTime = null;

            if (dnakeDownAlertSent)
            {
                dnakeDownAlertSent = false;
                SendNtfyAlert(
                    "BodyGate: DNake tornato online",
                    "Il bridge torna a contattare il DNake dopo un'interruzione. Verifica con un badge di test che il tornello apra.",
                    "default"
                );
            }
        }

        private static void NotifyPollFailed(Exception error)
        {
            if (firstPollFailureTime == null)
            {
                firstPollFailureTime = DateTime.Now;
                return;
            }

            if (dnakeDownAlertSent)
            {
                return;
            }

            if ((DateTime.Now - firstPollFailureTime.Value).TotalSeconds < PollDownAlertSeconds)
            {
                return;
            }

            dnakeDownAlertSent = true;

            if (error is DnakeDbIncompleteException incomplete)
            {
                SendNtfyAlert(
                    "BodyGate: database del DNake troncato",
                    "Il DNake consegna solo " + incomplete.ReceivedBytes + " byte su " +
                    (incomplete.ExpectedBytes?.ToString() ?? "?") +
                    " di unlock_sql.db: il file e' troppo grande e il bridge non legge piu' nessun badge. " +
                    "Svuota i registri/record di sblocco dal pannello web del DNake (NON fare il reset di fabbrica).",
                    "urgent"
                );
                return;
            }

            SendNtfyAlert(
                "BodyGate: DNake non risponde",
                "Il bridge non riesce a contattare il DNake da oltre " + PollDownAlertSeconds + " secondi. Il tornello probabilmente non fa entrare nessuno.",
                "urgent"
            );
        }

        // Avvisa quando il database del DNake si avvicina alla dimensione oltre la
        // quale il suo server web lo consegna troncato, cosi' si interviene prima
        // del blocco. Si riarma quando la dimensione torna sotto soglia.
        private static void CheckDbSizeWarning()
        {
            long size = lastDbExpectedBytes;

            if (size < 0)
            {
                return;
            }

            if (size < DbSizeWarnBytes)
            {
                dbSizeWarnSent = false;
                return;
            }

            if (dbSizeWarnSent)
            {
                return;
            }

            dbSizeWarnSent = true;
            SendNtfyAlert(
                "BodyGate: database del DNake quasi pieno",
                "unlock_sql.db sul DNake e' " + (size / 1024) + " KB (soglia di avviso " + (DbSizeWarnBytes / 1024) +
                " KB). Oltre circa 284 KB il DNake lo consegna troncato e il bridge smette di leggere i badge. " +
                "Svuota i registri/record di sblocco dal pannello web del DNake (NON fare il reset di fabbrica).",
                "high"
            );
        }

        private static string DescribeException(Exception error)
        {
            StringBuilder text = new StringBuilder();

            for (Exception? current = error; current != null; current = current.InnerException)
            {
                if (text.Length > 0)
                {
                    text.Append(" -> ");
                }

                text.Append(current.GetType().Name).Append(": ").Append(current.Message);
            }

            return text.ToString();
        }

        // Il guasto puo' ripetersi 10 volte al secondo: logga una volta ogni
        // PollErrorLogIntervalSeconds (con il conteggio dei ripetuti) invece di
        // far crescere bridge.log senza limite.
        private static void LogPollError(Exception error)
        {
            string description = DescribeException(error);
            DateTime now = DateTime.Now;

            lastPollError = description;

            if (
                description == lastLoggedPollError &&
                (now - lastPollErrorLogTime).TotalSeconds < PollErrorLogIntervalSeconds
            )
            {
                suppressedPollErrors++;
                return;
            }

            string suffix = suppressedPollErrors > 0
                ? " (+" + suppressedPollErrors + " errori identici non ripetuti)"
                : "";

            suppressedPollErrors = 0;
            lastLoggedPollError = description;
            lastPollErrorLogTime = now;

            Log("Errore polling DNake SQLite: " + description + suffix);
        }

        private static bool IsPollHealthy()
        {
            long ticks = System.Threading.Interlocked.Read(ref lastSuccessfulPollTicks);

            if (ticks == 0)
            {
                // Nessuna lettura riuscita: sano solo nei primi secondi dall'avvio.
                return (DateTime.Now - ProcessStartTime).TotalSeconds < PollHealthySeconds;
            }

            return (DateTime.Now - new DateTime(ticks)).TotalSeconds < PollHealthySeconds;
        }

        private static void CheckStaleAccessAlert()
        {
            int currentHour = DateTime.Now.Hour;

            if (currentHour < OperatingHourStart || currentHour >= OperatingHourEnd)
            {
                staleAccessAlertSent = false;
                return;
            }

            // Se il polling e' in errore l'allarme giusto e' quello del DNake che non
            // risponde: "nessun accesso" qui sarebbe fuorviante.
            if (firstPollFailureTime != null)
            {
                return;
            }

            DateTime lastBadgeSnapshot;

            lock (badgeLock)
            {
                lastBadgeSnapshot = lastBadgeTime;
            }

            // lastBadgeTime vale DateTime.MinValue finche' non c'e' un evento: partire
            // dall'avvio del processo evita il falso allarme "da 1065452214 min".
            if (lastBadgeSnapshot < ProcessStartTime)
            {
                lastBadgeSnapshot = ProcessStartTime;
            }

            double minutesSinceLastBadge = (DateTime.Now - lastBadgeSnapshot).TotalMinutes;

            if (minutesSinceLastBadge < StaleAccessAlertMinutes)
            {
                staleAccessAlertSent = false;
                return;
            }

            if (staleAccessAlertSent)
            {
                return;
            }

            staleAccessAlertSent = true;
            SendNtfyAlert(
                "BodyGate: nessun accesso da " + (int)minutesSinceLastBadge + " min",
                "Il DNake risponde ma non registra nuovi accessi da oltre " + StaleAccessAlertMinutes + " minuti in orario di apertura. Il lettore RFID potrebbe essere bloccato anche se il dispositivo sembra online: verifica con un badge di test.",
                "high"
            );
        }

        private static void SendNtfyAlert(string title, string message, string priority)
        {
            if (string.IsNullOrWhiteSpace(NtfyTopic))
            {
                Log("Alert ntfy non inviato (BODYGATE_NTFY_TOPIC non configurato): " + title);
                return;
            }

            try
            {
                using HttpRequestMessage request = new HttpRequestMessage(
                    HttpMethod.Post,
                    "https://ntfy.sh/" + NtfyTopic
                );

                request.Content = new StringContent(message, Encoding.UTF8);
                request.Headers.TryAddWithoutValidation("Title", title);
                request.Headers.TryAddWithoutValidation("Priority", priority);
                request.Headers.TryAddWithoutValidation("Tags", "warning");

                using HttpResponseMessage response = httpClient.Send(request);

                Log("Notifica ntfy inviata (" + (int)response.StatusCode + "): " + title);
            }
            catch (Exception ex)
            {
                Log("Errore invio notifica ntfy: " + ex.Message);
            }
        }

        private static DnakeUnlockEvent? ReadLatestDnakeEvent()
        {
            lock (pollLock)
            {
                // Fixed name per process, not one unique timestamp per poll: ReadLatestDnakeEvent
                // runs under pollLock (one poll at a time within this process), so there is no
                // concurrent-access risk from a single process reusing one file. A fixed
                // connection string also lets Microsoft.Data.Sqlite's connection pool
                // legitimately reuse one pooled connection across polls instead of accumulating
                // a new pooled entry (and open native file handle) every 200ms — that
                // accumulation was the original cause of the disk-fill bug fixed in PR #150.
                //
                // The PID is included because StartHttpServer only logs and returns if its
                // port bind fails (e.g. a second instance started alongside the scheduled one)
                // rather than exiting the process — so pollLock alone does not rule out two
                // separate BodyGateBridge processes polling concurrently. A per-process name
                // keeps that scenario from corrupting each other's snapshot instead of merely
                // making it rare.
                string tempPath = Path.Combine(
                    WorkDir,
                    "unlock_sql_" + Environment.ProcessId + ".db"
                );

                try
                {
                    DownloadDnakeDb(tempPath);

                    // Pooling=False is kept as a second, independent safeguard: even if this
                    // connection were ever opened with a non-constant path again in the
                    // future, a failed File.Delete would still leak at most the pool's normal
                    // eviction lag, not accumulate forever.
                    using SqliteConnection connection = new SqliteConnection(
                        "Data Source=" + tempPath + ";Mode=ReadOnly;Pooling=False"
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
                    catch (Exception cleanupError)
                    {
                        Log("Impossibile eliminare " + tempPath + ": " + cleanupError.Message);
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

            using HttpResponseMessage response = httpClient.Send(
                request,
                HttpCompletionOption.ResponseHeadersRead
            );

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception("Download DNake DB fallito: HTTP " + (int)response.StatusCode + " " + response.ReasonPhrase);
            }

            long? expectedBytes = response.Content.Headers.ContentLength;
            lastDbExpectedBytes = expectedBytes ?? -1;
            lastDbReceivedBytes = -1;

            using MemoryStream buffer = new MemoryStream();

            try
            {
                // HttpClient.Timeout non copre la lettura del corpo con
                // ResponseHeadersRead: serve un timeout esplicito, altrimenti un
                // download appeso bloccherebbe il polling.
                using CancellationTokenSource cts = new CancellationTokenSource(
                    TimeSpan.FromSeconds(DownloadBodyTimeoutSeconds)
                );

                using Stream body = response.Content.ReadAsStream(cts.Token);
                body.CopyToAsync(buffer, 81920, cts.Token).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                lastDbReceivedBytes = buffer.Length;
                throw new DnakeDbIncompleteException(buffer.Length, expectedBytes, ex);
            }

            lastDbReceivedBytes = buffer.Length;

            // Il DNake (mini_httpd) chiude la connessione prima della fine quando il
            // database e' troppo grande: un SQLite troncato non e' affidabile
            // (gli eventi piu' recenti sono proprio nelle pagine mancanti).
            if (expectedBytes.HasValue && buffer.Length != expectedBytes.Value)
            {
                throw new DnakeDbIncompleteException(buffer.Length, expectedBytes, null);
            }

            if (buffer.Length < 100)
            {
                throw new Exception("Download DNake DB troppo piccolo: " + buffer.Length + " bytes");
            }

            File.WriteAllBytes(destinationPath, buffer.ToArray());
        }

        private sealed class DnakeDbIncompleteException : Exception
        {
            public long ReceivedBytes { get; }
            public long? ExpectedBytes { get; }

            public DnakeDbIncompleteException(long receivedBytes, long? expectedBytes, Exception? inner)
                : base(
                    "Download DNake DB incompleto: ricevuti " + receivedBytes + " byte su " +
                    (expectedBytes?.ToString() ?? "?") +
                    " dichiarati. Il database del DNake e' probabilmente troppo grande: svuotare i registri sul DNake.",
                    inner
                )
            {
                ReceivedBytes = receivedBytes;
                ExpectedBytes = expectedBytes;
            }
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
                    // Senza il listener HTTP il bridge e' inutilizzabile, ma il ciclo di
                    // Main lo terrebbe vivo e start-bodygate-bridge.ps1 riavvia solo
                    // all'uscita del processo: esco, cosi' parte un'istanza pulita.
                    Log("Errore HTTP server, uscita per riavvio: " + ex.Message);
                    Environment.Exit(1);
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
                            openDelayAfterBadgeMs = OpenDelayAfterBadgeMs,
                            pollHealthy = IsPollHealthy(),
                            consecutivePollFailures,
                            lastPollError,
                            lastSuccessfulPoll = lastSuccessfulPollTicks == 0
                                ? ""
                                : new DateTime(System.Threading.Interlocked.Read(ref lastSuccessfulPollTicks)).ToString("s"),
                            dnakeDbExpectedBytes = lastDbExpectedBytes,
                            dnakeDbReceivedBytes = lastDbReceivedBytes,
                            uptimeSeconds = (int)(DateTime.Now - ProcessStartTime).TotalSeconds
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