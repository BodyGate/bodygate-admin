using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using TcpClass.Controller;

namespace BodyGateAccessBridge
{
    internal class Program
    {
        private static readonly string ControllerIp = "192.168.1.251";
        private static readonly int ControllerPort = 8000;
        private static readonly byte DoorIndex = 0;

        private static ClassTcpClientWorker tcpNet;
        private static TTCPPullCommand pullCommand;
        private static TTCPController controller;

        private static readonly string LogDir =
            Path.Combine(AppContext.BaseDirectory, "logs");

        private static readonly string LogFile =
            Path.Combine(LogDir, "bridge.log");

        private static void Main(string[] args)
        {
            Log("BodyGate Access Bridge avviato...");
            Log("Controller: " + ControllerIp + ":" + ControllerPort);
            Log("Bridge HTTP: http://localhost:5050/open");

            InitController();

            HttpListener listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:5050/");
            listener.Start();

            Log("In ascolto...");

            while (true)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();

                    ThreadPool.QueueUserWorkItem(_ =>
                    {
                        HandleRequest(context);
                    });
                }
                catch (Exception ex)
                {
                    Log("Errore listener: " + ex.Message);
                }
            }
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

        private static void InitController()
        {
            tcpNet = new ClassTcpClientWorker();

            pullCommand = new TTCPPullCommand();

            controller = new TTCPController(
                tcpNet,
                pullCommand
            );

            bool connected =
                tcpNet.OpenIP(
                    ControllerIp,
                    ControllerPort
                );

            Log("Connessione controller: " + connected);
        }

        private static void HandleRequest(
            HttpListenerContext context
        )
        {
            string path =
                context.Request.Url.AbsolutePath.ToLower();

            if (path == "/open")
            {
                bool result = OpenTurnstile();

                WriteJson(
                    context,
                    result
                        ? "{\"ok\":true,\"message\":\"Tornello aperto\"}"
                        : "{\"ok\":false,\"message\":\"Apertura fallita\"}"
                );

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
                    "}"
                );

                return;
            }

            WriteJson(
                context,
                "{\"ok\":false,\"message\":\"Endpoint non valido\"}",
                404
            );
        }

        private static bool OpenTurnstile()
        {
            try
            {
                if (
                    tcpNet == null ||
                    !tcpNet.IsConnectSuccess()
                )
                {
                    Log("Riconnessione al controller...");

                    InitController();

                    Thread.Sleep(300);
                }

                Log("Invio comando OpenDoor...");

                bool opened =
                    controller.OpenDoor(DoorIndex);

                Log("Risultato OpenDoor: " + opened);

                return opened;
            }
            catch (Exception ex)
            {
                Log("Errore apertura: " + ex.Message);

                return false;
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
    }
}