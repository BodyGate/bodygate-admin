import { NextResponse } from "next/server";

export async function POST() {
  try {
    const bridgeUrl = "http://localhost:5050/open";

    const response = await fetch(bridgeUrl, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      message: text || "Comando inviato al bridge",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Impossibile contattare il Bridge. Verifica che il Bridge C# sia avviato su localhost:5050.",
      },
      { status: 500 }
    );
  }
}