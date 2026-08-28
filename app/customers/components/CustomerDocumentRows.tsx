"use client";

import { useEffect, useId, useMemo, useState } from "react";
import DocumentScannerDrawer, { type ScannerConfirmMetadata, type ScannerOperationMode } from "./DocumentScannerDrawer";
import type { ScannerDocumentType } from "./documentScannerUtils";
import { computeMedicalCertificateStatus, formatDateIT, humanMedicalTime } from "./medicalCertificateUtils";

export type DocumentStatus = "missing" | "incomplete" | "uploaded" | "needs_dates" | "valid" | "expiring_soon" | "expired" | "pending" | "non_operational" | "error" | "replaced";

type Row = { type: ScannerDocumentType; title: string; side?: string; optional?: boolean };
type ExistingDocument = { id?: string; document_type?: string | null; title?: string | null; status?: string | null; created_at?: string | null; updated_at?: string | null; view_url?: string | null; public_url?: string | null; file_url?: string | null; url?: string | null; signed_at?: string | null; valid_from?: string | null; valid_until?: string | null };
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

const labels: Record<DocumentStatus, string> = { missing: "Non caricato", incomplete: "Documento da completare", uploaded: "Caricato", needs_dates: "Date mancanti", valid: "Valido", expiring_soon: "In scadenza", expired: "Scaduto", pending: "Validità futura", non_operational: "Non operativo", error: "Errore", replaced: "Sostituito" };

function certStatus(customer: any, pending?: PendingDocument): DocumentStatus {
  const start = pending?.validFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start;
  const end = pending?.validUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end;
  const hasFile = Boolean(pending?.file || customer?.medical_certificate_url);
  if (!hasFile && (start || end)) return "incomplete";
  return computeMedicalCertificateStatus({ hasFile, validFrom: start, validUntil: end });
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
  const [active, setActive] = useState<(Row & { initialFile?: File; initialMode?: "camera" | "file"; operationMode?: ScannerOperationMode; initialValidFrom?: string; initialValidUntil?: string }) | null>(null);
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
    docs.forEach((doc) => { if (doc.document_type && doc.status !== "replaced" && !map.has(doc.document_type)) map.set(doc.document_type, doc); });
    return map;
  }, [docs]);

  function openScanner(row: Row, initialMode: "camera" | "file", initialFile?: File, operationMode: ScannerOperationMode = "create", initialValidFrom?: string, initialValidUntil?: string) {
    setError("");
    setActive({ ...row, initialMode, initialFile, operationMode, initialValidFrom, initialValidUntil });
  }

  function handleNativeFileChange(row: Row, initialMode: "camera" | "file", file?: File, operationMode: ScannerOperationMode = "create", initialValidFrom?: string, initialValidUntil?: string) {
    if (!file) return;
    openScanner(row, initialMode, file, operationMode, initialValidFrom, initialValidUntil);
  }

  async function handleConfirm(file: File | null, metadata: ScannerConfirmMetadata) {
    const type = metadata.documentType as ScannerDocumentType;
    if (!customerId) {
      if (!file) throw new Error("File richiesto per il documento pending.");
      onPendingChange?.(type, { file, status: type === "medical_certificate" ? computeMedicalCertificateStatus({ hasFile: true, validFrom: metadata.validFrom, validUntil: metadata.validUntil }) : "uploaded", validFrom: metadata.validFrom || pendingDocuments[type]?.validFrom, validUntil: metadata.validUntil || pendingDocuments[type]?.validUntil, viewUrl: URL.createObjectURL(file) });
      setActive(null);
      return;
    }
    setBusyType(type);
    setError("");
    const current = byType.get(type);
    if (type === "medical_certificate" && metadata.operationMode === "dates_only") {
      const response = await fetch(`/api/customers/${customerId}/medical-certificate`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valid_from: metadata.validFrom, valid_until: metadata.validUntil }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Aggiornamento validità non riuscito.");
      onUploaded?.(result.document);
      await loadDocs();
      setActive(null); setBusyType(""); return;
    }
    if (!file) throw new Error("File documento mancante.");
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", type);
    if (current?.id) form.append("replace_document_id", current.id);
    if (type === "medical_certificate") {
      const validFrom = metadata.validFrom || "";
      const validUntil = metadata.validUntil || "";
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
      .doc-panel { min-width:0; overflow-x:auto; border:1px solid var(--border); border-radius:20px; background:var(--panel); padding:12px; color:var(--text); display:grid; gap:8px; }
      .head { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:2px 4px 6px; } .head b{font-size:17px;} .head span{color:var(--muted);font-size:12px;}
      .row { display:grid; grid-template-columns:minmax(190px,1.15fr) 118px minmax(150px,.9fr) auto; gap:9px; align-items:center; border:1px solid var(--border); border-radius:14px; padding:8px 10px; background:var(--panel-2); }
      .row.optional { border-style:dashed; background:var(--bg-soft); padding:7px 10px; }
      .name { font-weight:850; font-size:14px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .optional .name{font-weight:800;color:var(--muted)}.sub { color:var(--muted); font-size:11px; margin-top:1px; }
      .badge { justify-self:start; border-radius:999px; padding:6px 9px; font-size:11px; font-weight:900; background:var(--bg-soft); color:var(--muted); white-space:nowrap; } .valid,.uploaded{background:rgba(31,157,107,.12);color:var(--success)}.expiring_soon{background:rgba(179,121,10,.12);color:var(--warning)}.pending{background:rgba(37,99,235,.1);color:#1d4ed8}.expired,.non_operational,.error{background:rgba(214,49,74,.1);color:var(--danger)}.needs_dates,.incomplete{background:rgba(179,121,10,.12);color:var(--warning)}.missing,.replaced{background:var(--bg-soft);color:var(--muted)}
      .detail { color:var(--muted); font-size:11.5px; line-height:1.25; } .muted-detail{color:var(--muted)}.actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}.native-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.buttonlike,button{border:1px solid var(--border);background:var(--bg-soft);color:var(--text);border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;cursor:pointer;text-decoration:none;line-height:1;display:inline-flex;align-items:center;justify-content:center;min-height:34px;min-width:74px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:background .15s ease,border-color .15s ease,transform .15s ease}.buttonlike:hover,button:hover:not(:disabled){background:var(--accent-soft);border-color:rgba(91,61,245,.3)}.buttonlike:active,button:active:not(:disabled){transform:translateY(1px)}.buttonlike.primary{background:var(--accent);border-color:var(--accent);color:#fff}.buttonlike.primary:hover{background:var(--accent-2);border-color:var(--accent-2)}.buttonlike.subtle{min-width:auto;color:var(--text);background:var(--bg-soft)}.buttonlike.disabled,button:disabled{opacity:.42;cursor:not-allowed;pointer-events:none}.history{border:1px solid var(--border);border-radius:14px;padding:8px;background:var(--panel-2)}.history summary{cursor:pointer;font-weight:900;color:var(--text)}.history-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding:8px 0}.history-row div{display:grid;gap:2px}.history-row span,.history-empty{color:var(--muted);font-size:12px}.errorline{color:var(--danger);font-weight:800;font-size:13px;padding:0 4px}@media(max-width:960px){.row{grid-template-columns:minmax(0,1fr) auto}.detail{grid-column:1 / 2}.actions{grid-column:2 / 3;grid-row:1 / span 3;align-self:center;max-width:180px}.name{white-space:normal}}@media(max-width:640px){.row{grid-template-columns:1fr}.actions{grid-column:auto;grid-row:auto;justify-content:flex-start;max-width:none}.detail{grid-column:auto}}
    `}</style>
    <div className="head"><div><b>{compactTitle}</b><br/><span>Scanner compatto per reception e tablet</span></div></div>
    {rows.map((row) => {
      const status = statusFor(row); const doc = byType.get(row.type); const url = documentUrl(row.type, customer, doc, pendingDocuments[row.type]); const critical = row.type === "medical_certificate" && !["valid"].includes(status);
      const cameraInputId = `${inputNamespace}-${row.type}-camera`;
      const fileInputId = `${inputNamespace}-${row.type}-file`;
      const disabled = busyType === row.type;
      const hasDocument = Boolean(url || doc || pendingDocuments[row.type]);
      const hasLegacyMedicalDatesOnly = row.type === "medical_certificate" && !hasDocument && Boolean(customer?.medical_certificate_start_date || customer?.medical_certificate_start || customer?.medical_certificate_end_date || customer?.medical_certificate_end);
      const validFrom = pendingDocuments.medical_certificate?.validFrom || doc?.valid_from || customer?.medical_certificate_start_date || customer?.medical_certificate_start || "";
      const validUntil = pendingDocuments.medical_certificate?.validUntil || doc?.valid_until || customer?.medical_certificate_end_date || customer?.medical_certificate_end || "";
      const detail = row.type === "medical_certificate"
        ? !validFrom || !validUntil ? "Date validità mancanti" : `${formatDateIT(validFrom)} → ${formatDateIT(validUntil)} · ${humanMedicalTime(validFrom, validUntil)}`
        : doc?.created_at ? `Aggiornato ${new Date(doc.created_at).toLocaleDateString("it-IT")}` : pendingDocuments[row.type] ? "Pronto per salvataggio cliente" : row.optional ? "Aggiungi solo se necessario" : "Da acquisire";
      return <div className={`row${row.optional ? " optional" : ""}`} key={row.type}>
        <div><div className="name">{row.optional ? "+ Aggiungi altro documento" : `${row.title}${row.side ? ` · ${row.side}` : ""}`}</div><div className="sub">{critical ? "Bloccante accesso" : row.optional ? "Opzionale" : "Warning amministrativo"}</div></div>
        <div className={`badge ${status}`}>{labels[status]}</div>
        <div className={`detail${row.optional && !hasDocument ? " muted-detail" : ""}`}>{detail}</div>
        <div className="actions">
          <input id={cameraInputId} className="native-file" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(e) => { handleNativeFileChange(row, "camera", e.currentTarget.files?.[0], row.type === "medical_certificate" && hasDocument ? (status === "expired" ? "renew" : "replace") : "create", validFrom, validUntil); e.currentTarget.value = ""; }} />
          <input id={fileInputId} className="native-file" type="file" accept="image/*,.pdf" disabled={disabled} onChange={(e) => { handleNativeFileChange(row, "file", e.currentTarget.files?.[0], row.type === "medical_certificate" && hasDocument ? (status === "expired" ? "renew" : "replace") : "create", validFrom, validUntil); e.currentTarget.value = ""; }} />
          {row.type === "medical_certificate" && hasLegacyMedicalDatesOnly ? <>
            <button type="button" className="buttonlike primary" onClick={() => openScanner(row, "file", undefined, "create", validFrom, validUntil)} disabled={disabled}>Completa certificato</button>
          </> : row.type === "medical_certificate" && hasDocument ? <>
            {url ? <button type="button" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>{status === "expired" ? "Visualizza precedente" : "Visualizza"}</button> : null}
            <button type="button" onClick={() => openScanner(row, "file", undefined, "dates_only", validFrom, validUntil)} disabled={disabled}>{status === "needs_dates" ? "Completa validità" : "Modifica validità"}</button>
            <label className={`buttonlike primary${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : fileInputId} aria-disabled={disabled}>{status === "expired" ? "Rinnova" : "Sostituisci"}</label>
          </> : hasDocument ? <>
            {url ? <button type="button" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Visualizza</button> : null}
            <label className={`buttonlike primary${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : fileInputId} aria-disabled={disabled}>Sostituisci</label>
          </> : <>
            <label className={`buttonlike primary${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : cameraInputId} aria-disabled={disabled}>Scatta</label>
            <label className={`buttonlike subtle${disabled ? " disabled" : ""}`} htmlFor={disabled ? undefined : fileInputId} aria-disabled={disabled}>Carica</label>
          </>}
        </div>
      </div>;
    })}
    <details className="history"><summary>Storico certificati</summary>{docs.filter((doc) => doc.document_type === "medical_certificate").length === 0 ? <div className="history-empty">Nessuno storico certificati disponibile.</div> : docs.filter((doc) => doc.document_type === "medical_certificate").map((doc) => { const url = documentUrl("medical_certificate", customer, doc); return <div className="history-row" key={doc.id || doc.created_at}><div><b>{formatDateIT(doc.valid_from)} → {formatDateIT(doc.valid_until)}</b><span>{labels[(doc.status as DocumentStatus) || "uploaded"] || doc.status || "Caricato"} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString("it-IT") : "data non disponibile"}</span></div>{url ? <button type="button" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Visualizza</button> : <span className="history-empty">Documento non disponibile</span>}</div>; })}</details>
    {error ? <div className="errorline">{error}</div> : null}
    {active ? <DocumentScannerDrawer open title={`${active.title}${active.side ? ` — ${active.side}` : ""}`} documentType={active.type} initialFile={active.initialFile} initialMode={active.initialMode} operationMode={active.operationMode} initialValidFrom={active.type === "medical_certificate" ? (active.initialValidFrom || customer?.medical_certificate_start_date || customer?.medical_certificate_start || "") : undefined} initialValidUntil={active.type === "medical_certificate" ? (active.initialValidUntil || customer?.medical_certificate_end_date || customer?.medical_certificate_end || "") : undefined} onClose={() => setActive(null)} onConfirm={async (file, meta) => { try { await handleConfirm(file, meta); } catch (err: any) { setError(err?.message || "Errore upload documento"); setBusyType(""); throw err; } }} /> : null}
  </div>;
}
