import { NextResponse } from "next/server";
import { getCurrentAuthContext, UnauthorizedError } from "../../../lib/server/auth";
import { DigitalPassError, ensureDigitalPass } from "../../../lib/server/digitalPass";

export const dynamic = "force-dynamic";

function appUrlFromRequest(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  return (configured || new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuthContext();
    const body = await request.json();
    const customerId = String(body.customer_id || body.customerId || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 },
      );
    }

    const result = await ensureDigitalPass({
      customerId,
      appUrl: appUrlFromRequest(request),
      operatorName: auth.staffName,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof DigitalPassError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore attivazione Pass digitale",
      },
      { status: 500 },
    );
  }
}
