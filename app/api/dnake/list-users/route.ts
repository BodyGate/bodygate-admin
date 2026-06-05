import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DNAKE_IP = process.env.DNAKE_IP || "192.168.1.179";
const DNAKE_USERNAME = process.env.DNAKE_USERNAME || "admin";
const DNAKE_PASSWORD_MD5 = process.env.DNAKE_PASSWORD_MD5 || "";

function extractSessionId(setCookie: string | null) {
  if (!setCookie) return "";
  const match = setCookie.match(/SessionID=([^;]+)/i);
  return match?.[1] || "";
}

async function dnakeLogin() {
  const loginUrl = `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=login&username=${encodeURIComponent(
    DNAKE_USERNAME
  )}&password=${encodeURIComponent(DNAKE_PASSWORD_MD5)}`;

  const res = await fetch(loginUrl);
  const text = await res.text();
  const sessionId = extractSessionId(res.headers.get("set-cookie"));

  if (!res.ok || !sessionId) {
    throw new Error(`Login DNake fallito: ${res.status} ${text}`);
  }

  return sessionId;
}

export async function GET() {
  try {
    const sessionId = await dnakeLogin();

    const res = await fetch(
      `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=user`,
      {
        method: "GET",
        headers: {
          Cookie: `SessionID=${sessionId}`,
          Accept: "application/json, text/plain, */*",
        },
      }
    );

    const text = await res.text();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      response: text,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore lista utenti DNake",
      },
      { status: 500 }
    );
  }
}