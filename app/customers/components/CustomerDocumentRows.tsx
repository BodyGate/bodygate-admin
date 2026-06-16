"use client";

import { useEffect, useMemo, useState } from "react";
import DocumentScannerDrawer from "./DocumentScannerDrawer";
import type { ScannerDocumentType } from "./documentScannerUtils";

export type DocumentStatus = "missing" | "uploaded" | "needs_dates" | "valid" | "expired" | "non_operational" | "error";

type Row = { type: ScannerDocumentType; title: string; side?: string; optional?: boolean };
type ExistingDocument = { id?: string; document_type?: string | null; title?: string | null; status?: string | null; created_at?: string | null; view_url?: string | null; public_url?: string | null; file_url?: string | null; url?: string | null; signed_at?: string | null };
type PendingDocument = { file: File; status?: DocumentStatus; validFrom?: string; validUntil?: string; viewUrl?: string };

type Props = {
  customerId?: string;
  customer?: any;
  pendingDocuments?: Partial<Record<ScannerDocumentType, PendingDocument>>;
  onPendingChange?: (type: ScannerDocumentType, doc: PendingDocument) => void;
  onUploaded?: (payload: any) => void;
  compactTitle?: string;
};

const rows: Row[] = [
  { type: "customer_photo", title: "Foto cliente" },
  { type: "identity_front", title: "Documento identità", side: "fronte" },
  { type: "identity_back", title: "Documento identità", side: "retro" },
  { type: "health_card_front", title: "Tessera sanitaria", side: "fronte" },
  { type: "health_card_back", title: "Tessera sanitaria", side: "retro" },
  { type: "medical_certificate", title: "Certificato medico" },
  { type: "other", title: "Altro documento", optional: true },
];

const labels: Record<DocumentStatus, string> = { missing: "Mancante", uploaded: "Caricato", needs_dates: "Da completare", valid: "Valido", expired: "Scaduto", non_operational: "Non operativo", error: "Errore" };

function certStatus(customer: any, pending?: PendingDocument): DocumentStatus {
  const start = pending?.validFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start;
  const end = pending?.validUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end;
  const hasFile = Boolean(pending?.file || customer?.medical_certificate_url);
  if (!hasFile) return "non_operational";
  if (!start || !end) return "needs_dates";
  const today = new Date().toISOString().slice(0, 10);
  if (end < today) return "expired";
  if (start > today) return "non_operational";
  return "valid";
}

function documentUrl(type: ScannerDocumentType, customer: any, doc?: ExistingDocument, pending?: PendingDocument) {
  if (pending?.viewUrl) return pending.viewUrl;
  if (type === "customer_photo") return customer?.photo_url || doc?.view_url || doc?.public_url || doc?.file_url || doc?.url || "";
  if (type === "medical_certificate") return customer?.medical_certificate_url || doc?.view_url || doc?.public_url || doc?.file_url || doc?.url || "";
  return doc?.view_url || doc?.public_url || doc?.file_url || doc?.url || "";
}

export default function CustomerDocumentRows({ customerId, customer, pendingDocuments = {}, onPendingChange, onUploaded, compactTitle = "Documenti e certificato" }: Props) {
  const [docs, setDocs] = useState<ExistingDocument[]>([]);
  const [active, setActive] = useState<Row | null>(null);
  const [busyType, setBusyType] = useState<string>("");
  const [error, setError] = useState("");

  async function loadDocs() {
    if (!customerId) return;
    const res = await fetch(`/api/customers/${customerId}/documents/upload`, { method: "GET" }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.ok) setDocs(json.documents || []);
  }

  useEffect(() => { loadDocs(); }, [customerId]);

  const byType = useMemo(() => {
    const map = new Map<string, ExistingDocument>();
    docs.forEach((doc) => { if (doc.document_type && !map.has(doc.document_type)) map.set(doc.document_type, doc); });
    return map;
  }, [docs]);

  async function handleConfirm(file: File, metadata: any) {
    const type = metadata.documentType as ScannerDocumentType;
    if (!customerId) {
      onPendingChange?.(type, { file, status: type === "medical_certificate" ? certStatus(customer, pendingDocuments.medical_certificate) : "uploaded", validFrom: pendingDocuments[type]?.validFrom, validUntil: pendingDocuments[type]?.validUntil, viewUrl: URL.createObjectURL(file) });
      setActive(null);
      return;
    }
    setBusyType(type);
    setError("");
    const current = byType.get(type);
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", type);
    if (current?.id) form.append("replace_document_id", current.id);
    if (type === "medical_certificate") {
      const validFrom = pendingDocuments.medical_certificate?.validFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start || "";
      const validUntil = pendingDocuments.medical_certificate?.validUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end || "";
      form.append("valid_from", validFrom);
      form.append("valid_until", validUntil);
    }
    const response = await fetch(`/api/customers/${customerId}/documents/upload`, { method: "POST", body: form });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Upload non riuscito.");
    onUploaded?.(result.document);
    await loadDocs();
    setActive(null);
    setBusyType("");
  }

  function statusFor(row: Row): DocumentStatus {
    if (pendingDocuments[row.type]?.status) return pendingDocuments[row.type]!.status!;
    if (row.type === "medical_certificate") return certStatus(customer, pendingDocuments.medical_certificate);
    if (row.type === "customer_photo" && customer?.photo_url) return "uploaded";
    return byType.get(row.type) ? "uploaded" : row.optional ? "missing" : "missing";
  }

  return <div className="doc-panel">
    <style jsx>{`
      .doc-panel { border:1px solid #252525; border-radius:22px; background:linear-gradient(135deg,#121212,#070707); padding:14px; color:#fff; display:grid; gap:10px; }
      .head { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:2px 4px 8px; } .head b{font-size:18px;} .head span{color:#a3a3a3;font-size:12px;}
      .row { display:grid; grid-template-columns:minmax(150px,1fr) 128px minmax(120px,1fr) auto; gap:10px; align-items:center; border:1px solid #242424; border-radius:16px; padding:10px; background:#0c0c0c; }
      .name { font-weight:900; } .sub { color:#a3a3a3; font-size:12px; margin-top:2px; }
      .badge { justify-self:start; border-radius:999px; padding:7px 10px; font-size:12px; font-weight:900; background:#262626; color:#ddd; } .valid,.uploaded{background:#052e18;color:#86efac}.expired,.non_operational,.error{background:#3b0711;color:#fda4af}.needs_dates{background:#422006;color:#fcd34d}
      .detail { color:#bdbdbd; font-size:12px; } .actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end} button{border:1px solid #333;background:#151515;color:#fff;border-radius:11px;padding:8px 10px;font-size:12px;font-weight:900;cursor:pointer} button.primary{background:#e11d2e;border-color:#ef4444} button:disabled{opacity:.42;cursor:not-allowed}.errorline{color:#fb7185;font-weight:800;font-size:13px;padding:0 4px}@media(max-width:820px){.row{grid-template-columns:1fr}.actions{justify-content:flex-start}}
    `}</style>
    <div className="head"><div><b>{compactTitle}</b><br/><span>Scanner compatto per reception e tablet</span></div></div>
    {rows.map((row) => {
      const status = statusFor(row); const doc = byType.get(row.type); const url = documentUrl(row.type, customer, doc, pendingDocuments[row.type]); const critical = row.type === "medical_certificate" && !["valid"].includes(status);
      return <div className="row" key={row.type}>
        <div><div className="name">{row.title}{row.side ? ` — ${row.side}` : ""}</div><div className="sub">{critical ? "Bloccante accesso" : row.optional ? "Opzionale" : "Warning amministrativo"}</div></div>
        <div className={`badge ${status}`}>{labels[status]}</div>
        <div className="detail">{row.type === "medical_certificate" ? `${pendingDocuments.medical_certificate?.validFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start || "data inizio mancante"} → ${pendingDocuments.medical_certificate?.validUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end || "data fine mancante"}` : doc?.created_at ? `Aggiornato ${new Date(doc.created_at).toLocaleDateString("it-IT")}` : pendingDocuments[row.type] ? "Pronto per salvataggio cliente" : "Da acquisire"}</div>
        <div className="actions"><button type="button" className="primary" onClick={() => setActive(row)} disabled={busyType === row.type}>Scatta foto</button><button type="button" onClick={() => setActive(row)} disabled={busyType === row.type}>Carica file</button><button type="button" onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")} disabled={!url}>Visualizza</button><button type="button" onClick={() => setActive(row)} disabled={busyType === row.type}>{url || doc ? "Sostituisci" : "Sostituisci"}</button></div>
      </div>;
    })}
    {error ? <div className="errorline">{error}</div> : null}
    {active ? <DocumentScannerDrawer open title={`${active.title}${active.side ? ` — ${active.side}` : ""}`} documentType={active.type} onClose={() => setActive(null)} onConfirm={async (file, meta) => { try { await handleConfirm(file, meta); } catch (err: any) { setError(err?.message || "Errore upload documento"); setBusyType(""); throw err; } }} /> : null}
  </div>;
}
