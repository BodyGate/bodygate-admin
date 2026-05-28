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
        private static readonly string Version = "V3.5";

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

        private const int RawBadgePacketLength = 43;
        private const byte RawBadgeStartByte = 0x02;
        private const byte RawBadgePacketMarker = 0xAA;
        private const byte RawBadgeEventCommand = 0x56;
        private const int RawBadgePayloadLength = 0x22;
        private const int RawBadgePayloadOffset = 7;

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
            Log("Bridge HTTP: http://localhost:5050/open, /open0, /open1, /openlong0, /openlong1");
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

                    tcpNet.OnDataEvent += controller.HandleMessage;
                    tcpNet.OnDataEvent += TcpNet_OnDataEvent;
                    tcpNet.OnRxTxDataEvent += TcpNet_OnRxTxDataEvent;
                    controller.OnEventHandler += Controller_OnEventHandler;

                    Log("Hook eventi TCP: OnDataEvent -> HandleMessage + debug RX");
                    Log("Hook eventi TCP: OnRxTxDataEvent -> debug RX/TX");
                    Log("Hook eventi controller: OnEventHandler -> badge BodyGate");

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

        private static void TcpNet_OnDataEvent(byte[] buffRX, int len)
        {
            LogTcpBuffer("RX OnDataEvent", buffRX, len);
            TryProcessRawBadgeEvent(buffRX, len);
        }

        private static void TcpNet_OnRxTxDataEvent(byte[] buffRX, int len, bool isSend)
        {
            LogTcpBuffer(isSend ? "TX OnRxTxDataEvent" : "RX OnRxTxDataEvent", buffRX, len);
        }

        private static void LogTcpBuffer(string prefix, byte[] buffer, int len)
        {
            try
            {
                if (buffer == null)
                {
                    Log(prefix + ": buffer null, len=" + len);
                    return;
                }

                int safeLen = Math.Max(0, Math.Min(len, buffer.Length));
                int shownLen = Math.Min(safeLen, 128);

                StringBuilder hex =
                    new StringBuilder();

                for (int index = 0; index < shownLen; index++)
                {
                    if (index > 0)
                    {
                        hex.Append(' ');
                    }

                    hex.Append(buffer[index].ToString("X2"));
                }

                if (safeLen > shownLen)
                {
                    hex.Append(" ...");
                }

                Log(prefix + ": len=" + safeLen + " data=" + hex);
            }
            catch (Exception ex)
            {
                Log("Errore log TCP raw: " + ex.Message);
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

                ProcessBadge(
                    badge,
                    new BadgeEventInfo
                    {
                        Reader = acsEvent.Reader,
                        Door = acsEvent.Door,
                        EventType = acsEvent.EventType,
                        Datetime = acsEvent.Datetime,
                        Source = "SDK"
                    }
                );
            }
            catch (Exception ex)
            {
                Log("Errore evento badge: " + ex.Message);
            }
        }

        private static void TryProcessRawBadgeEvent(byte[] buffRX, int len)
        {
            try
            {
                RawBadgeEvent? rawEvent =
                    TryParseRawBadgeEvent(buffRX, len);

                if (rawEvent == null)
                {
                    return;
                }

                Log("DEBUG RAW badge estratto: " + rawEvent.DebugSummary);

                ProcessBadge(
                    rawEvent.Code,
                    new BadgeEventInfo
                    {
                        Reader = rawEvent.Reader,
                        Door = rawEvent.Door,
                        EventType = rawEvent.EventType,
                        Datetime = DateTime.Now,
                        Source = "RAW"
                    }
                );
            }
            catch (Exception ex)
            {
                Log("Errore parser badge raw: " + ex.Message);
            }
        }

        private static RawBadgeEvent? TryParseRawBadgeEvent(byte[] buffer, int len)
        {
            if (buffer == null)
            {
                return null;
            }

            int safeLen =
                Math.Max(0, Math.Min(len, buffer.Length));

            if (safeLen != RawBadgePacketLength)
            {
                return null;
            }

            if (
                buffer[0] != RawBadgeStartByte ||
                buffer[1] != RawBadgePacketMarker ||
                buffer[2] != RawBadgeEventCommand
            )
            {
                return null;
            }

            int payloadLength =
                (buffer[5] << 8) | buffer[6];

            if (payloadLength != RawBadgePayloadLength)
            {
                Log("DEBUG RAW len=43 ignorato: payload length inatteso " + payloadLength);
                return null;
            }

            RawBadgeCandidate? selectedCandidate = null;
            StringBuilder debugCandidates = new StringBuilder();

            for (int index = RawBadgePayloadOffset; index <= safeLen - 4; index++)
            {
                uint littleEndianValue =
                    ReadUInt32LittleEndian(buffer, index);

                AddRawBadgeCandidateDebug(
                    debugCandidates,
                    index,
                    "LE32",
                    littleEndianValue
                );

                if (IsLikelyRawBadgeValue(littleEndianValue))
                {
                    RawBadgeCandidate candidate =
                        new RawBadgeCandidate
                        {
                            Offset = index,
                            Endian = "LE32",
                            Value = littleEndianValue,
                            Score = ScoreRawBadgeCandidate(buffer, index, true)
                        };

                    selectedCandidate =
                        PickBetterRawBadgeCandidate(selectedCandidate, candidate);
                }

                uint bigEndianValue =
                    ReadUInt32BigEndian(buffer, index);

                AddRawBadgeCandidateDebug(
                    debugCandidates,
                    index,
                    "BE32",
                    bigEndianValue
                );

                if (IsLikelyRawBadgeValue(bigEndianValue))
                {
                    RawBadgeCandidate candidate =
                        new RawBadgeCandidate
                        {
                            Offset = index,
                            Endian = "BE32",
                            Value = bigEndianValue,
                            Score = ScoreRawBadgeCandidate(buffer, index, false)
                        };

                    selectedCandidate =
                        PickBetterRawBadgeCandidate(selectedCandidate, candidate);
                }
            }

            Log("DEBUG RAW badge candidates: " + debugCandidates);

            if (selectedCandidate == null)
            {
                Log("DEBUG RAW badge non estratto: nessun candidato valido nel pacchetto len=43");
                return null;
            }

            byte reader =
                TryReadByte(buffer, RawBadgePayloadOffset + 1, safeLen);

            byte door =
                TryReadByte(buffer, RawBadgePayloadOffset + 2, safeLen);

            byte eventType =
                TryReadByte(buffer, RawBadgePayloadOffset, safeLen);

            return new RawBadgeEvent
            {
                Code = selectedCandidate.Value.ToString(),
                Reader = reader,
                Door = door,
                EventType = eventType,
                DebugSummary =
                    "code=" + selectedCandidate.Value +
                    " offset=" + selectedCandidate.Offset +
                    " endian=" + selectedCandidate.Endian +
                    " score=" + selectedCandidate.Score
            };
        }

        private static RawBadgeCandidate PickBetterRawBadgeCandidate(
            RawBadgeCandidate? current,
            RawBadgeCandidate candidate
        )
        {
            if (current == null)
            {
                return candidate;
            }

            if (candidate.Score > current.Score)
            {
                return candidate;
            }

            if (
                candidate.Score == current.Score &&
                candidate.Offset < current.Offset
            )
            {
                return candidate;
            }

            return current;
        }

        private static bool IsLikelyRawBadgeValue(uint value)
        {
            return value >= 1000000 && value <= 99999999;
        }

        private static int ScoreRawBadgeCandidate(byte[] buffer, int offset, bool littleEndian)
        {
            int score = 0;

            if (littleEndian && buffer[offset + 3] == 0x00)
            {
                score += 100;
            }

            if (!littleEndian && buffer[offset] == 0x00)
            {
                score += 50;
            }

            if (offset >= RawBadgePayloadOffset + 3 && offset <= RawBadgePayloadOffset + 24)
            {
                score += 20;
            }

            return score;
        }

        private static void AddRawBadgeCandidateDebug(
            StringBuilder debugCandidates,
            int offset,
            string endian,
            uint value
        )
        {
            if (!IsLikelyRawBadgeValue(value))
            {
                return;
            }

            if (debugCandidates.Length > 0)
            {
                debugCandidates.Append("; ");
            }

            debugCandidates
                .Append(endian)
                .Append("@")
                .Append(offset)
                .Append("=")
                .Append(value);
        }

        private static uint ReadUInt32LittleEndian(byte[] buffer, int offset)
        {
            return
                (uint)(
                    buffer[offset] |
                    (buffer[offset + 1] << 8) |
                    (buffer[offset + 2] << 16) |
                    (buffer[offset + 3] << 24)
                );
        }

        private static uint ReadUInt32BigEndian(byte[] buffer, int offset)
        {
            return
                (uint)(
                    (buffer[offset] << 24) |
                    (buffer[offset + 1] << 16) |
                    (buffer[offset + 2] << 8) |
                    buffer[offset + 3]
                );
        }

        private static byte TryReadByte(byte[] buffer, int offset, int safeLen)
        {
            if (offset < 0 || offset >= safeLen)
            {
                return 0;
            }

            return buffer[offset];
        }

        private static void ProcessBadge(string badge, BadgeEventInfo badgeEvent)
        {
            if (string.IsNullOrWhiteSpace(badge))
                return;

            if (IsDuplicateBadge(badge))
            {
                Log("Badge duplicato ignorato: " + badge);
                return;
            }

            Log("================================");
            Log(badgeEvent.Source == "RAW" ? "BADGE CENTRALINA RAW" : "BADGE CENTRALINA");
            Log(badgeEvent.Source == "RAW" ? "BADGE LETTO RAW: " + badge : "BADGE LETTO: " + badge);
            Log("Badge: " + badge);
            Log("ControllerCode: " + badge);
            Log("Reader: " + badgeEvent.Reader);
            Log("Door: " + badgeEvent.Door);
            Log("EventType: " + badgeEvent.EventType);
            Log("Data/Ora evento: " + badgeEvent.Datetime);
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
                    badgeEvent,
                    openResult
                );

                return;
            }

            Log("ACCESSO AUTORIZZATO DA BODYGATE: " + badge);
            Log("Attesa prima apertura: " + OpenDelayAfterBadgeMs + " ms");

            Thread.Sleep(OpenDelayAfterBadgeMs);

            openResult =
                OpenTurnstileWithSafeRetry(DoorIndex, false);

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
                badgeEvent,
                openResult
            );
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
            BadgeEventInfo badgeEvent,
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
                    "\"door\":" + badgeEvent.Door + "," +
                    "\"reader\":" + badgeEvent.Reader + "," +
                    "\"event_type\":" + badgeEvent.EventType + "," +
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
                    HandleOpenRequest(context, DoorIndex, false);
                    return;
                }

                if (path == "/open0")
                {
                    HandleOpenRequest(context, 0, false);
                    return;
                }

                if (path == "/open1")
                {
                    HandleOpenRequest(context, 1, false);
                    return;
                }

                if (path == "/openlong0")
                {
                    HandleOpenRequest(context, 0, true);
                    return;
                }

                if (path == "/openlong1")
                {
                    HandleOpenRequest(context, 1, true);
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

        private static void HandleOpenRequest(
            HttpListenerContext context,
            byte doorIndex,
            bool useLongOpen
        )
        {
            OpenResult result =
                OpenTurnstileWithSafeRetry(doorIndex, useLongOpen);

            string commandName =
                useLongOpen ? "OpenDoorLong" : "OpenDoor";

            if (result.HasTrueResult)
            {
                WriteJson(
                    context,
                    new
                    {
                        ok = true,
                        opened = true,
                        warning = false,
                        door = doorIndex,
                        command = commandName,
                        message = "Tornello aperto",
                        version = Version
                    }
                );
            }
            else if (result.CommandSent)
            {
                WriteJson(
                    context,
                    new
                    {
                        ok = true,
                        opened = true,
                        warning = true,
                        door = doorIndex,
                        command = commandName,
                        message = "Comando " + commandName + " inviato una sola volta. SDK False gestito come warning tecnico.",
                        version = Version
                    }
                );
            }
            else
            {
                WriteJson(
                    context,
                    new
                    {
                        ok = false,
                        opened = false,
                        warning = true,
                        door = doorIndex,
                        command = commandName,
                        message = "Comando " + commandName + " non inviato. Controller non disponibile.",
                        version = Version
                    }
                );
            }
        }

        private static OpenResult OpenTurnstileWithSafeRetry(
            byte doorIndex,
            bool useLongOpen
        )
        {
            OpenResult finalResult =
                new OpenResult();

            string commandName =
                useLongOpen ? "OpenDoorLong" : "OpenDoor";

            for (int attempt = 1; attempt <= OpenRetryCount; attempt++)
            {
                Log(
                    "Tentativo apertura " +
                    commandName +
                    " porta " +
                    doorIndex +
                    " " +
                    attempt +
                    "/" +
                    OpenRetryCount
                );

                OpenAttemptResult attemptResult =
                    OpenTurnstileOnce(doorIndex, useLongOpen);

                if (attemptResult.CommandSent)
                {
                    finalResult.CommandSent = true;

                    if (attemptResult.SdkResult)
                    {
                        finalResult.HasTrueResult = true;
                        Log("Apertura riuscita al tentativo " + attempt);
                        return finalResult;
                    }

                    Log("WARNING tecnico: " + commandName + " ha restituito False al tentativo " + attempt);
                    Log("Comando " + commandName + " inviato. Stop retry per evitare impulsi multipli.");
                    LogControllerErrors();

                    return finalResult;
                }

                Log("Comando " + commandName + " NON inviato al tentativo " + attempt);
                LogControllerErrors();

                if (attempt < OpenRetryCount)
                {
                    Log("Retry consentito perche il comando non e stato inviato.");
                    Thread.Sleep(OpenRetryDelayMs);
                }
            }

            Log("WARNING tecnico finale: nessun comando " + commandName + " inviato dopo retry.");

            return finalResult;
        }

        private static OpenAttemptResult OpenTurnstileOnce(
            byte doorIndex,
            bool useLongOpen
        )
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

                string commandName =
                    useLongOpen ? "OpenDoorLong" : "OpenDoor";

                Log("Invio " + commandName + " porta " + doorIndex + "...");

                bool opened =
                    useLongOpen
                        ? controller.OpenDoorLong(doorIndex)
                        : controller.OpenDoor(doorIndex);

                Log("Risultato " + commandName + " SDK: " + opened);

                return new OpenAttemptResult
                {
                    CommandSent = true,
                    SdkResult = opened
                };
            }
            catch (Exception ex)
            {
                Log("Errore comando apertura: " + ex.Message);

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
            object payload,
            int statusCode = 200
        )
        {
            WriteJson(
                context,
                JsonSerializer.Serialize(payload),
                statusCode
            );
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

        private class BadgeEventInfo
        {
            public int Reader { get; set; }
            public int Door { get; set; }
            public int EventType { get; set; }
            public DateTime Datetime { get; set; } = DateTime.Now;
            public string Source { get; set; } = "SDK";
        }

        private class RawBadgeEvent
        {
            public string Code { get; set; } = "";
            public int Reader { get; set; }
            public int Door { get; set; }
            public int EventType { get; set; }
            public string DebugSummary { get; set; } = "";
        }

        private class RawBadgeCandidate
        {
            public int Offset { get; set; }
            public string Endian { get; set; } = "";
            public uint Value { get; set; }
            public int Score { get; set; }
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