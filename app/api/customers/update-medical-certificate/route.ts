import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isValidDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function dateOnlyToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerId = normalizeText(body.customer_id);
    const medicalCertificateUrl = normalizeText(body.medical_certificate_url);
    const medicalCertificateStartDate = normalizeText(
      body.medical_certificate_start_date
    );
    const medicalCertificateEndDate = normalizeText(body.medical_certificate_end_date);

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id obbligatorio" },
        { status: 400 }
      );
    }

    if (!medicalCertificateStartDate) {
      return NextResponse.json(
        { ok: false, error: "Data inizio certificato obbligatoria" },
        { status: 400 }
      );
    }

    if (!medicalCertificateEndDate) {
      return NextResponse.json(
        { ok: false, error: "Data fine certificato obbligatoria" },
        { status: 400 }
      );
    }

    if (
      !isValidDateOnly(medicalCertificateStartDate) ||
      !isValidDateOnly(medicalCertificateEndDate)
    ) {
      return NextResponse.json(
        { ok: false, error: "Date certificato non valide" },
        { status: 400 }
      );
    }

    if (medicalCertificateEndDate < medicalCertificateStartDate) {
      return NextResponse.json(
        { ok: false, error: "La data fine deve essere successiva o uguale alla data inizio" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingCustomer, error: existingCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .limit(1)
      .maybeSingle();

    if (existingCustomerError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore verifica cliente",
          detail: existingCustomerError.message,
        },
        { status: 500 }
      );
    }

    if (!existingCustomer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    const medicalCertificateStatus =
      medicalCertificateEndDate >= dateOnlyToday() ? "valid" : "expired";

    const { data: updatedCustomer, error: updateError } = await supabase
      .from("customers")
      .update({
        medical_certificate_url: medicalCertificateUrl,
        medical_certificate_start_date: medicalCertificateStartDate,
        medical_certificate_end_date: medicalCertificateEndDate,
        medical_certificate_status: medicalCertificateStatus,
        medical_certificate_start: medicalCertificateStartDate,
        medical_certificate_end: medicalCertificateEndDate,
      })
      .eq("id", customerId)
      .select("*")
      .single();

    if (updateError || !updatedCustomer) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore aggiornamento certificato medico",
          detail: updateError?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customer: updatedCustomer,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
