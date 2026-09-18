import { NextResponse } from "next/server";
import { generateFiscalCode } from "../../../lib/fiscalCode";

export async function POST(req: Request) {
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
