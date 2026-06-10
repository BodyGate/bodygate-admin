import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const bridgeBaseUrl =
  process.env.BODYGATE_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_BODYGATE_BRIDGE_URL ||
  "http://127.0.0.1:5050";

export async function POST() {
  const normalizedBaseUrl = bridgeBaseUrl.replace(/\/+$/g, "");
  const bridgeUrl = `${normalizedBaseUrl}/open`;

  try {
    const response = await fetch(bridgeUrl, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      bridge_url: bridgeUrl,
      message: text || "Comando inviato al bridge",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        bridge_url: bridgeUrl,
        message:
          "Impossibile contattare il Bridge. Verifica che il Bridge C# sia avviato e che BODYGATE_BRIDGE_URL sia corretto.",
        error: error?.message || "fetch failed",
      },
      { status: 500 }
    );
  }
}