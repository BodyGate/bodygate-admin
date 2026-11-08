import { withPermission } from "../../../lib/server/auth";
import { NextResponse } from "next/server";
import { generateFiscalCode } from "../../../lib/fiscalCode";

async function handlePOST(req: Request) {
  try {
    const body = await req.json();

    const result = generateFiscalCode({
      firstName: String(body.first_name || ""),
      lastName: String(body.last_name || ""),
      gender: String(body.gender || ""),
      birthDate: String(body.birth_date || ""),
      birthPlace: String(body.birth_place || ""),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, fiscal_code: result.fiscalCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = withPermission("edit_customers", handlePOST);
