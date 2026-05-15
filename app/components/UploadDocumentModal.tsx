"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  customerId: string;
  onUploaded: () => void;
};

export default function UploadDocumentModal({ customerId, onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("generic");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadDocument() {
    if (!file || !title.trim()) {
      alert("Inserisci titolo e seleziona un PDF.");
      return;
    }

    setUploading(true);

    const safeFileName = file.name.replaceAll(" ", "_");
    const filePath = `${customerId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      alert("Errore upload PDF: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from("documents").insert({
      customer_id: customerId,
      title: title.trim(),
      type,
      file_url: publicUrl,
      file_path: filePath,
      file_name: file.name,
      status: "uploaded",
    });

    if (insertError) {
      alert("PDF caricato, ma errore salvataggio documento: " + insertError.message);
      setUploading(false);
      return;
    }

    setTitle("");
    setType("generic");
    setFile(null);
    setOpen(false);
    setUploading(false);
    onUploaded();
  }

  return (
    <>
      <button style={buttonStyle} onClick={() => setOpen(true)}>
        Carica documento
      </button>

      {open && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={headerStyle}>
              <div>
                <h2 style={titleStyle}>Carica documento</h2>
                <p style={subtitleStyle}>
                  Archivia PDF, certificati, liberatorie o contratti.
                </p>
              </div>

              <button style={closeButtonStyle} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div style={formStyle}>
              <label style={labelStyle}>
                Titolo documento
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Contratto sala pesi"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Tipo documento
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="generic">Generico</option>
                  <option value="contract">Contratto</option>
                  <option value="privacy">Privacy</option>
                  <option value="medical_certificate">Certificato medico</option>
                  <option value="receipt">Ricevuta</option>
                  <option value="waiver">Liberatoria</option>
                </select>
              </label>

              <label style={labelStyle}>
                File PDF
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </label>

              <button
                style={{
                  ...submitButtonStyle,
                  opacity: uploading ? 0.6 : 1,
                }}
                disabled={uploading}
                onClick={uploadDocument}
              >
                {uploading ? "Caricamento..." : "Salva documento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "16px",
  background: "linear-gradient(to right, #ef4444, #dc2626)",
  color: "white",
  padding: "13px 18px",
  fontWeight: 800,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "24px",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  color: "var(--text)",
  boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  marginBottom: "24px",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "24px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--muted)",
};

const closeButtonStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  border: "1px solid var(--border)",
  background: "var(--panel-2)",
  color: "white",
  fontSize: "26px",
  lineHeight: "20px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: "var(--muted)",
  fontWeight: 700,
  fontSize: "14px",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "16px",
  background: "var(--panel-2)",
  color: "white",
  padding: "13px 14px",
  fontSize: "15px",
};

const submitButtonStyle: React.CSSProperties = {
  marginTop: "6px",
  border: "none",
  borderRadius: "18px",
  background: "linear-gradient(to right, #ef4444, #dc2626)",
  color: "white",
  padding: "15px 20px",
  fontWeight: 900,
  fontSize: "15px",
};