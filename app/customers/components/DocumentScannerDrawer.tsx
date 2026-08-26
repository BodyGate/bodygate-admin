"use client";

import { useEffect, useState } from "react";
import { compressImageFile, createSafeScannerFileName, formatFileSize, isImageFile, isPdfFile, rotateImageFile, validateScannerFile, type ScannerDocumentType } from "./documentScannerUtils";
import { addDaysISO, addOneYearISO, computeMedicalCertificateStatus, formatDateIT, humanMedicalTime, isISODate, todayLocalISO } from "./medicalCertificateUtils";

export type ScannerOperationMode = "create" | "renew" | "replace" | "dates_only";
export type ScannerConfirmMetadata = { originalName: string; size: number; mimeType: string; documentType: ScannerDocumentType; validFrom?: string; validUntil?: string; operationMode?: ScannerOperationMode };

type Props = {
  open: boolean;
  title: string;
  documentType: ScannerDocumentType;
  initialFile?: File;
  initialMode?: "camera" | "file";
  operationMode?: ScannerOperationMode;
  initialValidFrom?: string;
  initialValidUntil?: string;
  onClose: () => void;
  onConfirm: (file: File | null, metadata: ScannerConfirmMetadata) => Promise<void> | void;
};

export default function DocumentScannerDrawer({ open, title, documentType, initialFile, initialMode, operationMode = "create", initialValidFrom, initialValidUntil, onClose, onConfirm }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const isMedical = documentType === "medical_certificate";
  const datesOnly = isMedical && operationMode === "dates_only";
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [validUntilManual, setValidUntilManual] = useState(false);
  const [confirmExpired, setConfirmExpired] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess(false);
    setFile(initialFile || null);
    if (documentType === "medical_certificate") {
      const start = initialValidFrom || todayLocalISO();
      setValidFrom(start);
      setValidUntil(initialValidUntil || addOneYearISO(start));
      setValidUntilManual(Boolean(initialValidUntil));
      setConfirmExpired(false);
    }
  }, [open, initialFile, initialMode, documentType, initialValidFrom, initialValidUntil]);

  useEffect(() => {
    if (!file || !isImageFile(file)) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  function pick(nextFile?: File) {
    setError("");
    setSuccess(false);
    if (!nextFile) return;
    const result = validateScannerFile(nextFile, { allowPdf: true, allowImages: true });
    if (!result.valid) {
      setError(result.error || "File non valido.");
      return;
    }
    setFile(nextFile);
  }

  async function rotate() {
    if (!file || !isImageFile(file) || loading) return;
    setLoading(true);
    setError("");
    try {
      setFile(await rotateImageFile(file, 90));
    } catch (err: any) {
      setError(err?.message || "Rotazione non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  const fieldError = isMedical ? (!isISODate(validFrom) ? "Inserisci una data inizio valida." : !isISODate(validUntil) ? "Inserisci una data fine valida." : validUntil < validFrom ? "La data fine non può precedere la data inizio." : !datesOnly && !file ? "Acquisisci o carica il certificato medico." : "") : "";
  const selectedStatus = isMedical ? computeMedicalCertificateStatus({ hasFile: datesOnly || Boolean(file), validFrom, validUntil }) : "valid";

  async function confirm() {
    if (loading || (!file && !datesOnly) || fieldError) return;
    if (isMedical && selectedStatus === "expired" && !confirmExpired) { setConfirmExpired(true); return; }
    setLoading(true);
    setError("");
    try {
      let finalFile: File | null = null;
      if (file) {
        const safeName = createSafeScannerFileName({ documentType, originalName: file.name, extension: isPdfFile(file) ? "pdf" : "jpg" });
        finalFile = isImageFile(file) ? await compressImageFile(file, { fileName: safeName }) : new File([file], safeName, { type: file.type || "application/pdf" });
      }
      await onConfirm(finalFile, { originalName: file?.name || "validita-certificato", size: finalFile?.size || 0, mimeType: finalFile?.type || "", documentType, validFrom: isMedical ? validFrom : undefined, validUntil: isMedical ? validUntil : undefined, operationMode });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Conferma scansione non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scanner-backdrop" role="dialog" aria-modal="true">
      <style jsx>{`
        .scanner-backdrop { position: fixed; inset: 0; z-index: 80; width: 100%; height: 100vh; height: 100dvh; background: rgba(0,0,0,.74); display: flex; justify-content: flex-end; color: #fff; overflow: hidden; }
        .drawer { width: min(560px, 100%); height: 100vh; max-height: 100vh; height: 100dvh; max-height: 100dvh; min-height: 0; background: linear-gradient(145deg,#111,#050505); border-left: 1px solid #2b2b2b; display: grid; grid-template-rows: auto minmax(0,1fr) auto; box-shadow: -24px 0 60px rgba(0,0,0,.45); overflow: hidden; }
        .top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 18px 14px; border-bottom:1px solid #242424; background:linear-gradient(145deg,#111,#070707); } .top-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; } .top-actions button { min-height:44px; }
        .body { min-height:0; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding:14px 18px 16px; display:grid; gap:12px; align-content:start; scrollbar-width:thin; scrollbar-color:#525252 #111; }
        .body::-webkit-scrollbar { width:10px; } .body::-webkit-scrollbar-track{background:#111}.body::-webkit-scrollbar-thumb{background:#525252;border-radius:999px;border:2px solid #111}
        h2 { margin:0; font-size:22px; letter-spacing:-.03em; } p { margin:5px 0 0; color:#a3a3a3; font-size:13px; }
        button { border:1px solid #333; background:#151515; color:#fff; border-radius:14px; padding:12px 14px; font-weight:900; cursor:pointer; }
        button:disabled { opacity:.45; cursor:not-allowed; }
        .primary { background:#e11d2e; border-color:#5b3df5; } .ghost { background:#090909; }
        .file-action { position: relative; border: 1px solid #333; background: #151515; color: #fff; border-radius: 14px; padding: 12px 14px; font-weight: 900; cursor: pointer; text-align: center; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        .file-action.primary-action { background: #e11d2e; border-color: #5b3df5; }
        .file-action.disabled { opacity: .45; cursor: not-allowed; pointer-events: none; }
        .file-input { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; opacity: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; pointer-events: none; }
        .stage { border:1px solid #2d2d2d; border-radius:22px; min-height:330px; max-height:48vh; background: radial-gradient(circle at top,#1d1d1d,#080808); display:flex; align-items:center; justify-content:center; overflow:hidden; padding:14px; }
        .stage.medical { min-height:200px; max-height:260px; }
        img { width:100%; height:100%; max-height:420px; object-fit:contain; border-radius:16px; }
        .stage.medical img { max-height:232px; }
        .empty, .pdf { text-align:center; color:#b8b8b8; display:grid; gap:8px; } .pdf b { color:#fff; font-size:28px; }
        .actions { position:relative; z-index:2; min-height:0; max-height:46vh; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:10px; padding:12px 18px calc(12px + env(safe-area-inset-bottom)); border-top:1px solid #2b2b2b; background:linear-gradient(180deg,rgba(8,8,8,.96),#050505); box-shadow:0 -18px 36px rgba(0,0,0,.34); } .actions .wide { grid-column:1 / -1; }
        .validity{border:1px solid #2b2b2b;border-radius:18px;padding:12px;display:grid;gap:10px;background:#0b0b0b}.validity label{display:grid;gap:6px;color:#ddd;font-size:12px;font-weight:900}.validity input{color-scheme:dark;background:#121212;border:1px solid #383838;border-radius:12px;color:#fff;padding:10px;font-weight:800}.quick{display:flex;gap:8px;flex-wrap:wrap}.summary{border-radius:14px;padding:10px;font-size:12px;line-height:1.45;background:#111827;color:#bfdbfe}.summary.valid,.summary.expiring_soon{background:#052e18;color:#bbf7d0}.summary.expired{background:#3b0711;color:#fecdd3}.summary.pending{background:#0b2447;color:#bfdbfe}.summary.missing{background:#422006;color:#fcd34d}.warning{color:#fbbf24;font-weight:900;font-size:13px}.error { color:#fb7185; font-weight:800; font-size:13px; } .success { color:#86efac; font-weight:800; font-size:13px; }
        @media (max-height: 780px) { .top { padding:14px 16px 10px; } .body { padding:10px 16px 12px; gap:10px; } .stage.medical { min-height:180px; max-height:220px; } .actions { padding:10px 16px calc(10px + env(safe-area-inset-bottom)); } }
        @media (max-width: 520px) { .drawer { width:100%; border-left:0; } h2{font-size:20px}.stage{min-height:260px;max-height:38vh}.stage.medical{min-height:160px;max-height:190px}.actions{grid-template-columns:1fr 1fr}.top{padding:14px}.body{padding:10px 14px 12px} }
      `}</style>
      <div className="drawer">
        <div className="top"><div><h2>{isMedical ? (operationMode === "dates_only" ? "Modifica validità certificato" : operationMode === "renew" ? "Rinnova certificato medico" : "Nuovo certificato medico") : title}</h2><p>{isMedical ? "Acquisisci il documento e definisci il periodo di validità." : "Scanner documentale BodyGate: verifica l’anteprima e conferma."}</p></div><div className="top-actions"><button className="primary" type="button" onClick={confirm} disabled={Boolean(fieldError) || (!file && !datesOnly) || loading}>{loading ? "Elaborazione..." : isMedical ? "Salva" : "Conferma"}</button><button className="ghost" type="button" onClick={onClose}>Chiudi</button></div></div>
        <div className="body">
          {isMedical ? <div className="validity"><label>Inizio validità<input type="date" value={validFrom} onChange={(e) => { const next = e.currentTarget.value; setValidFrom(next); if (!validUntilManual) setValidUntil(addOneYearISO(next)); setConfirmExpired(false); }} /></label><label>Fine validità<input type="date" value={validUntil} onChange={(e) => { setValidUntil(e.currentTarget.value); setValidUntilManual(true); setConfirmExpired(false); }} /></label><div className="quick"><button type="button" onClick={() => { const t = todayLocalISO(); setValidFrom(t); if (!validUntilManual) setValidUntil(addOneYearISO(t)); }}>Oggi</button><button type="button" onClick={() => { setValidUntil(addOneYearISO(validFrom)); setValidUntilManual(true); }}>+1 anno</button><button type="button" onClick={() => { setValidUntil(addDaysISO(validFrom, 365)); setValidUntilManual(true); }}>+365 giorni</button></div><div className={`summary ${selectedStatus}`}>Il certificato sarà valido dal {formatDateIT(validFrom, true)} al {formatDateIT(validUntil, true)}.<br />{selectedStatus === "pending" ? `Certificato salvato, operativo dal ${formatDateIT(validFrom)}.` : selectedStatus === "expired" ? "Il periodo selezionato è già terminato. Il cliente resterà non valido." : selectedStatus === "missing" ? "Carica il file per completare il certificato." : "Il cliente risulterà valido sotto il profilo medico."}<br /><strong>{humanMedicalTime(validFrom, validUntil)}</strong></div>{fieldError ? <div className="error">{fieldError}</div> : null}{confirmExpired ? <div className="warning">Conferma consapevole: premi di nuovo Salva per registrare un periodo già scaduto.</div> : null}</div> : null}
          <div className={`stage${isMedical ? " medical" : ""}`}>
            {preview ? <img src={preview} alt="Anteprima scansione" /> : file && isPdfFile(file) ? <div className="pdf"><b>PDF</b><span>{file.name} · {formatFileSize(file.size)}</span></div> : datesOnly ? <div className="empty"><b>Documento già presente</b><span>Modifica solo le date, senza ricaricare il file.</span></div> : <div className="empty"><b>Nessuna scansione</b><span>Usa la camera o carica un file.</span></div>}
          </div>
        </div>
        <div className="actions">
          <label className={`file-action primary-action${loading ? " disabled" : ""}`} htmlFor="scanner-camera-input" aria-disabled={loading}>
            <span>Scatta foto</span>
          </label>
          <input id="scanner-camera-input" className="file-input" type="file" accept="image/*" capture="environment" disabled={loading} onChange={(e) => { pick(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          <label className={`file-action${loading ? " disabled" : ""}`} htmlFor="scanner-file-input" aria-disabled={loading}>
            <span>Carica file</span>
          </label>
          <input id="scanner-file-input" className="file-input" type="file" accept="image/*,.pdf" disabled={loading} onChange={(e) => { pick(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          <button type="button" onClick={() => setFile(null)} disabled={!file || loading}>Ripeti</button>
          <button type="button" onClick={rotate} disabled={!file || !isImageFile(file) || loading}>Ruota</button>
          {error ? <div className="error wide">{error}</div> : null}{success ? <div className="success wide">Scansione confermata.</div> : null}
        </div>
      </div>
    </div>
  );
}
