import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tableHasColumn } from "../../../../lib/server/defaultBranch";
import { formatDateIT, isISODate, persistedMedicalCertificateStatus } from "../../../../customers/components/medicalCertificateUtils";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const validFrom = String(body.valid_from || "").trim();
    const validUntil = String(body.valid_until || "").trim();
    if (!isISODate(validFrom) || !isISODate(validUntil)) return NextResponse.json({ ok: false, error: "Date validità non valide." }, { status: 400 });
    if (validUntil < validFrom) return NextResponse.json({ ok: false, error: "La data fine non può precedere la data inizio." }, { status: 400 });
    const { data: customer, error: customerError } = await supabase.from("customers").select("id, medical_certificate_start_date, medical_certificate_end_date").eq("id", id).maybeSingle();
    if (customerError || !customer) return NextResponse.json({ ok: false, error: "Cliente non trovato." }, { status: 404 });

    const { data: active, error } = await supabase.from("customer_documents").select("*").eq("customer_id", id).eq("document_type", "medical_certificate").neq("status", "replaced").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!active) return NextResponse.json({ ok: false, error: "Nessun certificato medico attivo da aggiornare." }, { status: 404 });

    const [hasValidFrom, hasValidUntil] = await Promise.all([
      tableHasColumn(supabase, "customer_documents", "valid_from"),
      tableHasColumn(supabase, "customer_documents", "valid_until"),
    ]);
    const status = persistedMedicalCertificateStatus({ hasFile: true, validFrom, validUntil });
    const updateDoc: Record<string, string> = { status };
    if (hasValidFrom) updateDoc.valid_from = validFrom;
    if (hasValidUntil) updateDoc.valid_until = validUntil;
    const { data: document, error: updateError } = await supabase.from("customer_documents").update(updateDoc).eq("id", active.id).eq("customer_id", id).select("*").single();
    if (updateError) throw new Error(updateError.message);
    await supabase.from("customers").update({ medical_certificate_start_date: validFrom, medical_certificate_end_date: validUntil, medical_certificate_status: status }).eq("id", id);
    await supabase.from("customer_timeline").insert({ customer_id: id, type: "medical_certificate", title: "Validità certificato medico modificata", description: `Validità modificata da ${formatDateIT(customer.medical_certificate_start_date)}–${formatDateIT(customer.medical_certificate_end_date)} a ${formatDateIT(validFrom)}–${formatDateIT(validUntil)}.`, created_at: new Date().toISOString() });
    const viewUrl = document.view_url || document.public_url || document.file_url || document.url || null;
    return NextResponse.json({ ok: true, document: { id: document.id, customer_id: id, document_type: "medical_certificate", title: document.title || "Certificato medico", status, valid_from: validFrom, valid_until: validUntil, created_at: document.created_at, view_url: viewUrl } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Aggiornamento certificato non riuscito." }, { status: 500 });
  }
}
