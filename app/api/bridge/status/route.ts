import { exec } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execAsync = promisify(exec);

type BridgeStatusPayload = {
  ok?: boolean;
  connected?: boolean;
  version?: string;
  [key: string]: unknown;
};

async function isBridgeProcessActive() {
  if (process.platform !== "win32") {
    return {
      active: null,
      method: "not-windows",
      note: "Process watchdog disponibile solo su Windows host.",
    };
  }

  try {
    const { stdout } = await execAsync(
      'tasklist /FI "IMAGENAME eq BodyGateAccessBridge.exe" /FO CSV /NH'
    );
    const active = stdout.toLowerCase().includes("bodygateaccessbridge.exe");

    return {
      active,
      method: "tasklist",
      note: active ? null : "Processo bridge non trovato in tasklist.",
    };
  } catch (error: unknown) {
    return {
      active: null,
      method: "tasklist",
      note: error instanceof Error ? error.message : "Errore tasklist",
    };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const processInfo = await isBridgeProcessActive();

  try {
    const [statusRes, healthRes] = await Promise.all([
      fetch("http://localhost:5050/status", { cache: "no-store" }),
      fetch("http://localhost:5050/health", { cache: "no-store" }),
    ]);

    const bridgeStatus = (await statusRes.json()) as BridgeStatusPayload;
    const bridgeHealth = healthRes.ok ? await healthRes.json() : null;
    const connected = Boolean(bridgeStatus?.connected);

    const watchdogState = !statusRes.ok
      ? "offline"
      : !connected
      ? "degraded"
      : "online";

    const watchdogError = !statusRes.ok
      ? `Bridge /status HTTP ${statusRes.status}`
      : !connected
      ? "Bridge raggiungibile ma centralina non connessa (connected=false)."
      : processInfo.active === false
      ? "Bridge HTTP risponde ma processo BodyGateAccessBridge.exe non rilevato."
      : null;

    return NextResponse.json({
      ok: true,
      online: statusRes.ok,
      bridge: bridgeStatus,
      health: bridgeHealth,
      checked_at: checkedAt,
      watchdog: {
        state: watchdogState,
        process_active: processInfo.active,
        process_check: processInfo.method,
        process_note: processInfo.note,
        last_error: watchdogError,
        restart_suggested: watchdogState !== "online",
        auto_restart_enabled: false,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({
      ok: true,
      online: false,
      bridge: null,
      health: null,
      checked_at: checkedAt,
      error: error instanceof Error ? error.message : "Bridge non raggiungibile",
      watchdog: {
        state: "offline",
        process_active: processInfo.active,
        process_check: processInfo.method,
        process_note: processInfo.note,
        last_error:
          error instanceof Error ? error.message : "Bridge non raggiungibile",
        restart_suggested: true,
        auto_restart_enabled: false,
      },
    });
  }
}
