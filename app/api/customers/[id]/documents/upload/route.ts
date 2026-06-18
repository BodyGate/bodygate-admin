import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tableHasColumn } from "../../../../../lib/server/defaultBranch";
import { buildCustomerDocumentStoragePath, createSafeScannerFileName, type ScannerDocumentType } from "../../../../../customers/components/documentScannerUtils";
import { formatDateIT, isISODate, persistedMedicalCertificateStatus } from "../../../../../customers/components/medicalCertificateUtils";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const allowed: ScannerDocumentType[] = ["customer_photo", "identity_front", "identity_back", "health_card_front", "health_card_back", "medical_certificate", "privacy", "waiver", "other"];
const imageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const pdfTypes = new Set(["application/pdf"]);
const maxSize = 10 * 1024 * 1024;

function titleFor(type: ScannerDocumentType) {
  return ({ customer_photo: "Foto cliente", identity_front: "Documento identità — fronte", identity_back: "Documento identità — retro", health_card_front: "Tessera sanitaria — fronte", health_card_back: "Tessera sanitaria — retro", medical_certificate: "Certificato medico", privacy: "Privacy", waiver: "Liberatoria", other: "Altro documento" } as Record<ScannerDocumentType, string>)[type];
}
function bucketFor(type: ScannerDocumentType) { return type === "customer_photo" ? "customer-photos" : type === "medical_certificate" ? "medical-certificates" : "documents"; }
function statusForCertificate(start: string | null, end: string | null) { return persistedMedicalCertificateStatus({ hasFile: true, validFrom: start, validUntil: end }); }

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error } = await supabase.from("customer_documents").select("*").eq("customer_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: "Archivio documenti non disponibile." }, { status: 500 });
  return NextResponse.json({ ok: true, documents: data || [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { data: customer, error: customerError } = await supabase.from("customers").select("id").eq("id", id).maybeSingle();
    if (customerError || !customer) return NextResponse.json({ ok: false, error: "Cliente non trovato." }, { status: 404 });

    const form = await req.formData();
    const type = String(form.get("document_type") || "") as ScannerDocumentType;
    const file = form.get("file");
    const replaceDocumentId = String(form.get("replace_document_id") || "").trim();
    if (!allowed.includes(type)) return NextResponse.json({ ok: false, error: "Tipo documento non consentito." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File documento mancante." }, { status: 400 });
    const mime = (file.type || "").toLowerCase();
    if (![...imageTypes, ...pdfTypes].includes(mime)) return NextResponse.json({ ok: false, error: "Formato non supportato." }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ ok: false, error: "File troppo grande. Limite 10MB." }, { status: 400 });

    const validFrom = String(form.get("valid_from") || "").trim() || null;
    const validUntil = String(form.get("valid_until") || "").trim() || null;
    if (type === "medical_certificate") {
      if (!validFrom || !validUntil) return NextResponse.json({ ok: false, error: "Inserisci inizio e fine validità certificato." }, { status: 400 });
      if (!isISODate(validFrom) || !isISODate(validUntil)) return NextResponse.json({ ok: false, error: "Formato date certificato non valido." }, { status: 400 });
      if (validUntil < validFrom) return NextResponse.json({ ok: false, error: "La data fine certificato deve essere successiva alla data inizio." }, { status: 400 });
    }

    const bucket = bucketFor(type);
    const ext = pdfTypes.has(mime) ? "pdf" : "jpg";
    const fileName = createSafeScannerFileName({ documentType: type, originalName: file.name, extension: ext });
    const path = buildCustomerDocumentStoragePath(id, type, fileName);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: mime || undefined });
    if (uploadError) throw new Error(`Upload non riuscito: ${uploadError.message}`);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const [hasFileUrl, hasFilePath, hasFileName, hasBucket, hasReplacedBy, hasValidFrom, hasValidUntil, hasSignedAt] = await Promise.all([
      tableHasColumn(supabase, "customer_documents", "file_url"), tableHasColumn(supabase, "customer_documents", "file_path"), tableHasColumn(supabase, "customer_documents", "file_name"), tableHasColumn(supabase, "customer_documents", "bucket"), tableHasColumn(supabase, "customer_documents", "replaced_by_document_id"), tableHasColumn(supabase, "customer_documents", "valid_from"), tableHasColumn(supabase, "customer_documents", "valid_until"), tableHasColumn(supabase, "customer_documents", "signed_at"),
    ]);

    const documentStatus = type === "medical_certificate" ? statusForCertificate(validFrom, validUntil) : "uploaded";
    const insertPayload: Record<string, any> = { customer_id: id, type, document_type: type, title: titleFor(type), status: documentStatus };
    if (hasFileUrl) insertPayload.file_url = publicUrl;
    if (hasFilePath) insertPayload.file_path = path;
    if (hasFileName) insertPayload.file_name = fileName;
    if (hasBucket) insertPayload.bucket = bucket;
    if (hasValidFrom) insertPayload.valid_from = validFrom;
    if (hasValidUntil) insertPayload.valid_until = validUntil;
    if (hasSignedAt && type !== "medical_certificate") insertPayload.signed_at = null;

    const { data: document, error: insertError } = await supabase.from("customer_documents").insert(insertPayload).select("*").single();
    if (insertError) throw new Error(`Documento caricato ma metadati non salvati: ${insertError.message}`);
    if (replaceDocumentId) {
      const replacement: Record<string, any> = { status: "replaced" };
      if (hasReplacedBy) replacement.replaced_by_document_id = document.id;
      await supabase.from("customer_documents").update(replacement).eq("id", replaceDocumentId).eq("customer_id", id);
    }

    if (type === "customer_photo") await supabase.from("customers").update({ photo_url: publicUrl }).eq("id", id);
    if (type === "medical_certificate") {
      await supabase.from("customers").update({ medical_certificate_url: publicUrl, medical_certificate_start_date: validFrom, medical_certificate_end_date: validUntil, medical_certificate_status: documentStatus }).eq("id", id);
      await supabase.from("customer_timeline").insert({ customer_id: id, type: "medical_certificate", title: replaceDocumentId ? "Certificato medico rinnovato" : "Certificato medico caricato", description: `Validità ${formatDateIT(validFrom)} → ${formatDateIT(validUntil)}.`, created_at: new Date().toISOString() });
    }

    return NextResponse.json({ ok: true, document: { id: document.id, customer_id: id, document_type: type, title: titleFor(type), status: documentStatus, valid_from: validFrom, valid_until: validUntil, created_at: document.created_at || new Date().toISOString(), view_url: publicUrl } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Errore upload documento." }, { status: 500 });
  }
}
