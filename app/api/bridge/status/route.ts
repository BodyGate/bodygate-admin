import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch("http://localhost:5050/status", {
      cache: "no-store",
    });

    const data = await res.json();
    const connected =
      typeof data?.connected === "boolean"
        ? data.connected
        : typeof data?.isConnected === "boolean"
          ? data.isConnected
          : true;

    const processing =
      typeof data?.processing === "boolean"
        ? data.processing
        : typeof data?.isProcessing === "boolean"
          ? data.isProcessing
          : false;

    return NextResponse.json({
      ok: true,
      online: true,
      connected,
      lastBadge: data?.lastBadge ?? data?.last_badge ?? null,
      lastBadgeTime: data?.lastBadgeTime ?? data?.last_badge_time ?? null,
      processing,
      bridge: data,
      checked_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json({
      ok: true,
      online: false,
      connected: false,
      lastBadge: null,
      lastBadgeTime: null,
      processing: false,
      bridge: null,
      error:
        error instanceof Error ? error.message : "Bridge non raggiungibile",
      checked_at: new Date().toISOString(),
    });
  }
}
