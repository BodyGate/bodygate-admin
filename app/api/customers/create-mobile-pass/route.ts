import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("39")) return cleaned;
  if (cleaned.startsWith("0")) return `39${cleaned}`;
  return `39${cleaned}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const customerId = String(body.customer_id || body.customerId || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, phone, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato", detail: customerError },
        { status: 404 }
      );
    }

    if (!customer.phone) {
      return NextResponse.json(
        { ok: false, error: "Numero WhatsApp mancante nel cliente" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const createRes = await fetch(`${appUrl}/api/customers/create-mobile-pass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerId,
      }),
    });

    const createJson = await createRes.json();

    if (!createJson.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: createJson.error || "Errore creazione Mobile Pass",
          detail: createJson,
        },
        { status: 500 }
      );
    }

    const passUrl = `${appUrl}${createJson.mobile_url}`;

    const firstName = customer.first_name || "cliente";

    const message =
      `Ciao ${firstName},\n\n` +
      `il tuo accesso Body Energy è stato attivato.\n\n` +
      `Apri il tuo Mobile Pass da questo link:\n${passUrl}\n\n` +
      `Mostra il QR al lettore DNake per entrare in palestra.\n\n` +
      `Body Energy ASD`;

    const whatsappUrl = `https://wa.me/${normalizePhone(
      customer.phone
    )}?text=${encodeURIComponent(message)}`;

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "mobile_pass_whatsapp",
      title: "Invio Mobile Pass WhatsApp",
      description: `Link WhatsApp generato per Mobile Pass: ${createJson.mobile_url}`,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      public_token: createJson.public_token,
      mobile_url: createJson.mobile_url,
      pass_url: passUrl,
      whatsapp_url: whatsappUrl,
      created: createJson.created,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore invio Mobile Pass",
      },
      { status: 500 }
    );
  }
}