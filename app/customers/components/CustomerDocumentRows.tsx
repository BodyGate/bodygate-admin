"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
  const inputNamespace = useId().replace(/:/g, "");
  const [active, setActive] = useState<(Row & { initialFile?: File; initialMode?: "camera" | "file" }) | null>(null);
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

  function openScanner(row: Row, initialMode: "camera" | "file", initialFile?: File) {
    setError("");
    setActive({ ...row, initialMode, initialFile });
  }

  function handleNativeFileChange(row: Row, initialMode: "camera" | "file", file?: File) {
    if (!file) return;
    openScanner(row, initialMode, file);
  }

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
      .doc-panel { border:1px solid #252525; border-radius:20px; background:linear-gradient(135deg,#121212,#070707); padding:12px; color:#fff; display:grid; gap:8px; }
      .head { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:2px 4px 6px; } .head b{font-size:17px;} .head span{color:#a3a3a3;font-size:12px;}
      .row { display:grid; grid-template-columns:minmax(190px,1.15fr) 118px minmax(150px,.9fr) auto; gap:9px; align-items:center; border:1px solid #222; border-radius:14px; padding:8px 10px; background:rgba(12,12,12,.86); }
      .row.optional { border-style:dashed; background:rgba(8,8,8,.56); padding:7px 10px; }
      .name { font-weight:850; font-size:14px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .optional .name{font-weight:800;color:#d7d7d7}.sub { color:#9b9b9b; font-size:11px; margin-top:1px; }
      .badge { justify-self:start; border-radius:999px; padding:6px 9px; font-size:11px; font-weight:900; background:#262626; color:#ddd; white-space:nowrap; } .valid,.uploaded{background:#052e18;color:#86efac}.expired,.non_operational,.error{background:#3b0711;color:#fda4af}.needs_dates{background:#422006;color:#fcd34d}
      .detail { color:#bdbdbd; font-size:11.5px; line-height:1.25; } .muted-detail{color:#898989}.actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}.native-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.buttonlike,button{border:1px solid #343434;background:#151515;color:#fff;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;cursor:pointer;text-decoration:none;line-height:1;display:inline-flex;align-items:center;justify-content:center;min-height:34px;min-width:74px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:background .15s ease,border-color .15s ease,transform .15s ease}.buttonlike:hover,button:hover:not(:disabled){background:#202020;border-color:#4a4a4a}.buttonlike:active,button:active:not(:disabled){transform:translateY(1px)}.buttonlike.primary{background:#e11d2e;border-color:#ef4444}.buttonlike.primary:hover{background:#f02b3d}.buttonlike.subtle{min-width:auto;color:#f1f1f1;background:#101010}.buttonlike.disabled,button:disabled{opacity:.42;cursor:not-allowed;pointer-events:none}.errorline{color:#fb7185;font-weight:800;font-size:13px;padding:0 4px}@media(max-width:960px){.row{grid-template-columns:minmax(0,1fr) auto}.detail{grid-column:1 / 2}.actions{grid-column:2 / 3;grid-row:1 / span 3;align-self:center;max-width:180px}.name{white-space:normal}}@media(max-width:640px){.row{grid-template-columns:1fr}.actions{grid-column:auto;grid-row:auto;justify-content:flex-start;max-width:none}.detail{grid-column:auto}}
    `}</style>
    <div className="head"><div><b>{compactTitle}</b><br/><span>Scanner compatto per reception e tablet</span></div></div>
    {rows.map((row) => {
      const status = statusFor(row); const doc = byType.get(row.type); const url = documentUrl(row.type, customer, doc, pendingDocuments[row.type]); const critical = row.type === "medical_certificate" && !["valid"].includes(status);
      const cameraInputId = `${inputNamespace}-${row.type}-camera`;
      const fileInputId = `${inputNamespace}-${row.type}-file`;
      const disabled = busyType === row.type;
      const hasDocument = Boolean(url || doc || pendingDocuments[row.type]);
      const validFrom = pendingDocuments.medical_certificate?.validFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start || "";
      const validUntil = pendingDocuments.medical_certificate?.validUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end || "";
      const detail = row.type === "medical_certificate"
        ? !validFrom || !validUntil ? "Date validità mancanti" : `${validFrom} → ${validUntil}`
        : doc?.created_at ? `Aggiornato ${new Date(doc.created_at).toLocaleDateString("it-IT")}` : pendingDocuments[row.type] ? "Pronto per salvataggio cliente" : row.optional ? "Aggiungi solo se necessario" : "Da acquisire";
      return <div className={`row${row.optional ? " optional" : ""}`} key={row.type}>
        <div><div className="name">{row.optional ? "+ Aggiungi altro documento" : `${row.title}${row.side ? ` · ${row.side}` : ""}`}</div><div className="sub">{critical ? "Bloccante accesso" : row.optional ? "Opzionale" : "Warning amministrativo"}</div></div>
        <div className={`badge ${status}`}>{labels[status]}</div>
        <div className={`detail${row.optional && !hasDocument ? " muted-detail" : ""}`}>{detail}</div>
        <div className="actions">
          <input id={cameraInputId} className="native-file" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(e) => { handleNativeFileChange(row, "camera", e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          <input id={fileInputId} className="native-file" type="file" accept="image/*,.pdf" disabled={disabled} onChange={(e) => { handleNativeFileChange(row, "file", e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          {hasDocument ? <>
            {url ? <button type="button" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Visualizza</button> : null}
            <label className={`buttonlike primary${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : fileInputId} aria-disabled={disabled}>Sostituisci</label>
          </> : <>
            <label className={`buttonlike primary${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : cameraInputId} aria-disabled={disabled}>Scatta</label>
            <label className={`buttonlike subtle${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : fileInputId} aria-disabled={disabled}>Carica</label>
          </>}
        </div>
      </div>;
    })}
    {error ? <div className="errorline">{error}</div> : null}
    {active ? <DocumentScannerDrawer open title={`${active.title}${active.side ? ` — ${active.side}` : ""}`} documentType={active.type} initialFile={active.initialFile} initialMode={active.initialMode} onClose={() => setActive(null)} onConfirm={async (file, meta) => { try { await handleConfirm(file, meta); } catch (err: any) { setError(err?.message || "Errore upload documento"); setBusyType(""); throw err; } }} /> : null}
  </div>;
}
