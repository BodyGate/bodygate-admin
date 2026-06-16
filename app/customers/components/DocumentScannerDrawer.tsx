"use client";

import { useEffect, useState } from "react";
import { compressImageFile, createSafeScannerFileName, isImageFile, isPdfFile, rotateImageFile, validateScannerFile, type ScannerDocumentType } from "./documentScannerUtils";

type Props = {
  open: boolean;
  title: string;
  documentType: ScannerDocumentType;
  initialFile?: File;
  initialMode?: "camera" | "file";
  onClose: () => void;
  onConfirm: (file: File, metadata: { originalName: string; size: number; mimeType: string; documentType: ScannerDocumentType }) => Promise<void> | void;
};

export default function DocumentScannerDrawer({ open, title, documentType, initialFile, initialMode, onClose, onConfirm }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess(false);
    setFile(initialFile || null);
  }, [open, initialFile, initialMode]);

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

  async function confirm() {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    try {
      const safeName = createSafeScannerFileName({ documentType, originalName: file.name, extension: isPdfFile(file) ? "pdf" : "jpg" });
      const finalFile = isImageFile(file) ? await compressImageFile(file, { fileName: safeName }) : new File([file], safeName, { type: file.type || "application/pdf" });
      await onConfirm(finalFile, { originalName: file.name, size: finalFile.size, mimeType: finalFile.type, documentType });
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
        .scanner-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.74); display: flex; justify-content: flex-end; color: #fff; }
        .drawer { width: min(560px, 100%); background: linear-gradient(145deg,#111,#050505); border-left: 1px solid #2b2b2b; padding: 18px; display: grid; grid-template-rows: auto 1fr auto; gap: 14px; box-shadow: -24px 0 60px rgba(0,0,0,.45); }
        .top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        h2 { margin:0; font-size:22px; letter-spacing:-.03em; } p { margin:5px 0 0; color:#a3a3a3; font-size:13px; }
        button { border:1px solid #333; background:#151515; color:#fff; border-radius:14px; padding:12px 14px; font-weight:900; cursor:pointer; }
        button:disabled { opacity:.45; cursor:not-allowed; }
        .primary { background:#e11d2e; border-color:#ef4444; } .ghost { background:#090909; }
        .file-action { position: relative; border: 1px solid #333; background: #151515; color: #fff; border-radius: 14px; padding: 12px 14px; font-weight: 900; cursor: pointer; text-align: center; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        .file-action.primary-action { background: #e11d2e; border-color: #ef4444; }
        .file-action.disabled { opacity: .45; cursor: not-allowed; pointer-events: none; }
        .file-input { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; opacity: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; pointer-events: none; }
        .stage { border:1px solid #2d2d2d; border-radius:22px; min-height:330px; background: radial-gradient(circle at top,#1d1d1d,#080808); display:flex; align-items:center; justify-content:center; overflow:hidden; padding:14px; }
        img { width:100%; height:100%; max-height:420px; object-fit:contain; border-radius:16px; }
        .empty, .pdf { text-align:center; color:#b8b8b8; display:grid; gap:8px; } .pdf b { color:#fff; font-size:28px; }
        .actions { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:10px; } .actions .wide { grid-column:1 / -1; }
        .error { color:#fb7185; font-weight:800; font-size:13px; } .success { color:#86efac; font-weight:800; font-size:13px; }
      `}</style>
      <div className="drawer">
        <div className="top"><div><h2>{title}</h2><p>Scanner documentale BodyGate: verifica l’anteprima e conferma.</p></div><button className="ghost" type="button" onClick={onClose}>Chiudi</button></div>
        <div className="stage">
          {preview ? <img src={preview} alt="Anteprima scansione" /> : file && isPdfFile(file) ? <div className="pdf"><b>PDF</b><span>Documento pronto per la conferma</span></div> : <div className="empty"><b>Nessuna scansione</b><span>Usa la camera o carica un file.</span></div>}
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
          <button className="primary wide" type="button" onClick={confirm} disabled={!file || loading}>{loading ? "Elaborazione..." : "Conferma scansione"}</button>
          {error ? <div className="error wide">{error}</div> : null}{success ? <div className="success wide">Scansione confermata.</div> : null}
        </div>
      </div>
    </div>
  );
}
