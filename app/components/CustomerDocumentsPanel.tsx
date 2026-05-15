"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  customerId: string;
};

type DocumentItem = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  signed_at: string | null;
  document_type: string | null;
};

export default function CustomerDocumentsPanel({
  customerId,
}: Props) {
  const [documents, setDocuments] = useState<
    DocumentItem[]
  >([]);

  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);

    const { data } = await supabase
      .from("customer_documents")
      .select(
        `
        id,
        title,
        status,
        created_at,
        signed_at,
        document_type
      `
      )
      .eq("customer_id", customerId)
      .order("created_at", {
        ascending: false,
      });

    setDocuments((data || []) as DocumentItem[]);

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "24px",
        padding: "24px",
      }}
    >
      <div
        style={{
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "22px",
        }}
      >
        Archivio documenti
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)" }}>
          Caricamento documenti...
        </div>
      ) : documents.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>
          Nessun documento presente.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "14px",
          }}
        >
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                background: "var(--bg-soft)",
                border:
                  "1px solid var(--border)",
                borderRadius: "18px",
                padding: "18px",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "18px",
                  }}
                >
                  {doc.title ||
                    "Documento"}
                </div>

                <div
                  style={{
                    color:
                      "var(--muted)",
                    marginTop: "6px",
                    fontSize: "14px",
                  }}
                >
                  Tipo:{" "}
                  {doc.document_type ||
                    "-"}
                </div>

                <div
                  style={{
                    color:
                      "var(--muted)",
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  Creato:{" "}
                  {new Date(
                    doc.created_at
                  ).toLocaleString(
                    "it-IT"
                  )}
                </div>

                {doc.signed_at && (
                  <div
                    style={{
                      color:
                        "var(--muted)",
                      marginTop: "4px",
                      fontSize: "14px",
                    }}
                  >
                    Firmato:{" "}
                    {new Date(
                      doc.signed_at
                    ).toLocaleString(
                      "it-IT"
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding:
                    "10px 16px",
                  borderRadius:
                    "999px",
                  fontWeight: "bold",
                  background:
                    doc.status ===
                    "signed"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(245,158,11,0.15)",
                  color:
                    doc.status ===
                    "signed"
                      ? "#22c55e"
                      : "#f59e0b",
                }}
              >
                {(doc.status ||
                  "generated")
                  .toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}