"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import UploadDocumentModal from "./UploadDocumentModal";

type DocumentItem = {
  id: string;
  customer_id: string;
  title: string;
  type: string;
  file_url: string;
  file_path: string | null;
  file_name: string | null;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export default function CustomerDocuments({
  customerId,
}: {
  customerId: string;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocuments(data as DocumentItem[]);
    }

    setLoading(false);
  }

  async function deleteDocument(documentId: string, filePath?: string | null) {
    const confirmed = confirm(
      "Vuoi eliminare definitivamente questo documento?"
    );

    if (!confirmed) return;

    if (filePath) {
      await supabase.storage.from("documents").remove([filePath]);
    }

    await supabase.from("documents").delete().eq("id", documentId);

    loadDocuments();
  }

  useEffect(() => {
    loadDocuments();
  }, [customerId]);

  if (loading) {
    return <div style={boxStyle}>Caricamento documenti...</div>;
  }

  return (
    <section style={boxStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Documenti cliente</h2>

          <p style={subtitleStyle}>
            Contratti, liberatorie, certificati e documenti archiviati.
          </p>
        </div>

        <UploadDocumentModal
          customerId={customerId}
          onUploaded={loadDocuments}
        />
      </div>

      {documents.length === 0 ? (
        <div style={emptyStyle}>Nessun documento presente.</div>
      ) : (
        <div style={listStyle}>
          {documents.map((doc) => (
            <div key={doc.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={docTitleStyle}>{doc.title}</div>

                <div style={metaStyle}>
                  {doc.type} ·{" "}
                  {new Date(doc.created_at).toLocaleDateString("it-IT")}
                </div>
              </div>

              <div style={actionsStyle}>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Apri PDF
                </a>

                <button
                  onClick={() =>
                    deleteDocument(doc.id, doc.file_path)
                  }
                  style={deleteButtonStyle}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const boxStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
  color: "var(--text)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "22px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "22px",
  margin: "0 0 8px",
};

const subtitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  margin: 0,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
  color: "var(--muted)",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "16px",
  borderRadius: "18px",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const docTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "15px",
};

const metaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
  marginTop: "5px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
};

const linkStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  padding: "10px 14px",
  borderRadius: "14px",
  whiteSpace: "nowrap",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#ef4444",
  padding: "10px 14px",
  borderRadius: "14px",
  fontWeight: 800,
};