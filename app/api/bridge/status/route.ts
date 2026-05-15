import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch("http://localhost:5050/status", {
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      online: true,
      bridge: data,
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: true,
      online: false,
      bridge: null,
      error: error?.message ?? "Bridge non raggiungibile",
      checked_at: new Date().toISOString(),
    });
  }
}