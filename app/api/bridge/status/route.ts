import { exec } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

const bridgeBaseUrl =
  process.env.BODYGATE_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_BODYGATE_BRIDGE_URL ||
  "http://127.0.0.1:5050";

type BridgeStatusPayload = {
  ok?: boolean;
  connected?: boolean;
  isConnected?: boolean;
  processing?: boolean;
  isProcessing?: boolean;
  lastBadge?: string | null;
  last_badge?: string | null;
  lastBadgeTime?: string | null;
  last_badge_time?: string | null;
  version?: string;
  [key: string]: unknown;
};

async function isBridgeProcessActive() {
  if (process.platform !== "win32") {
    return {
      active: null as boolean | null,
      method: "not-windows",
      note: "Process watchdog disponibile solo su Windows host.",
    };
  }

  const processNames = [
    "BodyGateAccessBridge.exe",
    "BodyGateBridge.exe",
    "bridge.exe",
  ];

  for (const processName of processNames) {
    try {
      const { stdout } = await execAsync(
        `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`
      );

      if (stdout.toLowerCase().includes(processName.toLowerCase())) {
        return {
          active: true,
          method: "tasklist",
          process_name: processName,
          note: null,
        };
      }
    } catch {
      // Continua con il prossimo nome processo.
    }
  }

  return {
    active: false,
    method: "tasklist",
    process_name: null,
    note: "Processo bridge non trovato in tasklist.",
  };
}

async function fetchJsonSafe(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1600);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      error: null as string | null,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      json: null,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const processInfo = await isBridgeProcessActive();

  const normalizedBaseUrl = bridgeBaseUrl.replace(/\/+$/g, "");
  const statusUrl = `${normalizedBaseUrl}/status`;
  const healthUrl = `${normalizedBaseUrl}/health`;

  const statusResult = await fetchJsonSafe(statusUrl);
  const healthResult = await fetchJsonSafe(healthUrl);

  const bridgeStatus = (statusResult.json || {}) as BridgeStatusPayload;
  const bridgeHealth = healthResult.ok ? healthResult.json : null;

  const connected =
    typeof bridgeStatus?.connected === "boolean"
      ? bridgeStatus.connected
      : typeof bridgeStatus?.isConnected === "boolean"
        ? bridgeStatus.isConnected
        : statusResult.ok;

  const processing =
    typeof bridgeStatus?.processing === "boolean"
      ? bridgeStatus.processing
      : typeof bridgeStatus?.isProcessing === "boolean"
        ? bridgeStatus.isProcessing
        : false;

  const online = statusResult.ok || healthResult.ok || processInfo.active === true;

  const watchdogState = !online
    ? "offline"
    : !statusResult.ok && processInfo.active === true
      ? "degraded"
      : !connected
        ? "degraded"
        : "online";

  const lastError =
    statusResult.error ||
    (!statusResult.ok ? `Bridge /status HTTP ${statusResult.status}` : null) ||
    healthResult.error ||
    null;

  return NextResponse.json({
    ok: true,
    online,
    connected,
    lastBadge: bridgeStatus?.lastBadge ?? bridgeStatus?.last_badge ?? null,
    lastBadgeTime:
      bridgeStatus?.lastBadgeTime ?? bridgeStatus?.last_badge_time ?? null,
    processing,
    bridge: bridgeStatus,
    health: bridgeHealth,
    checked_at: checkedAt,
    bridge_base_url: normalizedBaseUrl,
    status_url: statusUrl,
    health_url: healthUrl,
    watchdog: {
      state: watchdogState,
      process_active: processInfo.active,
      process_name: processInfo.process_name ?? null,
      process_check: processInfo.method,
      process_note: processInfo.note,
      last_error: watchdogState === "online" ? null : lastError,
      restart_suggested: watchdogState === "offline",
      auto_restart_enabled: false,
    },
  });
}