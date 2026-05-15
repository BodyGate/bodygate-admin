"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  customerId: string;
};

type Certificate = {
  id: string;
  customer_id: string;
  certificate_type: string | null;
  valid_from: string;
  valid_until: string;
  status: string | null;
  notes: string | null;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

export default function CustomerMedicalCertificates({ customerId }: Props) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [certificateType, setCertificateType] = useState("non_agonistico");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function loadCertificates() {
    setLoading(true);

    const { data, error } = await supabase
      .from("medical_certificates")
      .select("*")
      .eq("customer_id", customerId)
      .order("valid_until", { ascending: false });

    if (error) {
      setMessage("Errore caricamento certificati: " + error.message);
      setCertificates([]);
    } else {
      setCertificates((data || []) as Certificate[]);
    }

    setLoading(false);
  }

  function addOneYear(dateString: string) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  function formatDate(dateString: string) {
    return new Date(`${dateString}T12:00:00`).toLocaleDateString("it-IT");
  }

  function handleValidFromChange(value: string) {
    setValidFrom(value);

    if (value) {
      setValidUntil(addOneYear(value));
    } else {
      setValidUntil("");
    }
  }

  function getCertificateStatus(cert: Certificate) {
    const today = new Date().toISOString().slice(0, 10);

    if (today < cert.valid_from) {
      return {
        label: "NON ANCORA VALIDO",
        color: "#f59e0b",
      };
    }

    if (today > cert.valid_until) {
      return {
        label: "SCADUTO",
        color: "#ef4444",
      };
    }

    const warningDate = new Date(`${cert.valid_until}T12:00:00`);
    warningDate.setDate(warningDate.getDate() - 30);
    const warningString = warningDate.toISOString().slice(0, 10);

    if (today >= warningString) {
      return {
        label: "IN SCADENZA",
        color: "#f59e0b",
      };
    }

    return {
      label: "VALIDO",
      color: "#22c55e",
    };
  }

  async function createCertificate() {
    setSaving(true);
    setMessage("");

    if (!validFrom || !validUntil) {
      setMessage("Inserisci data inizio e data fine validità.");
      setSaving(false);
      return;
    }

    if (validUntil < validFrom) {
      setMessage(
        "La data fine validità non può essere precedente alla data inizio."
      );
      setSaving(false);
      return;
    }

    let fileUrl: string | null = null;
    let filePath: string | null = null;
    let fileName: string | null = null;

    if (file) {
      const safeFileName = file.name.replaceAll(" ", "_");
      filePath = `${customerId}/medical-${Date.now()}-${safeFileName}`;
      fileName = file.name;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          contentType: file.type || "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        setMessage("Errore upload certificato: " + uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      fileUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabase
      .from("medical_certificates")
      .insert({
        customer_id: customerId,
        certificate_type: certificateType,
        valid_from: validFrom,
        valid_until: validUntil,
        expiry_date: validUntil,
        status: "valid",
        notes: notes.trim() || null,
        file_url: fileUrl,
        file_path: filePath,
        file_name: fileName,
      });

    if (insertError) {
      setMessage("Errore salvataggio certificato: " + insertError.message);
      setSaving(false);
      return;
    }

    setMessage("Certificato medico salvato correttamente.");
    setValidFrom("");
    setValidUntil("");
    setCertificateType("non_agonistico");
    setNotes("");
    setFile(null);

    await loadCertificates();

    setSaving(false);
  }

  async function deleteCertificate(cert: Certificate) {
    const confirmed = confirm("Vuoi eliminare questo certificato medico?");
    if (!confirmed) return;

    if (cert.file_path) {
      await supabase.storage.from("documents").remove([cert.file_path]);
    }

    await supabase.from("medical_certificates").delete().eq("id", cert.id);
    await loadCertificates();
  }

  useEffect(() => {
    loadCertificates();
  }, [customerId]);

  return (
    <div style={panelStyle}>
      <div style={panelTitleStyle}>Certificato medico</div>

      <div style={formGridStyle}>
        <select
          value={certificateType}
          onChange={(e) => setCertificateType(e.target.value)}
          style={inputStyle}
        >
          <option value="non_agonistico">Non agonistico</option>
          <option value="agonistico">Agonistico</option>
          <option value="altro">Altro</option>
        </select>

        <input
          type="date"
          value={validFrom}
          onChange={(e) => handleValidFromChange(e.target.value)}
          style={inputStyle}
        />

        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          style={inputStyle}
        />

        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={inputStyle}
        />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note certificato medico"
        style={textareaStyle}
      />

      <button onClick={createCertificate} disabled={saving} style={primaryButton}>
        {saving ? "Salvataggio..." : "Salva certificato medico"}
      </button>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={{ marginTop: "30px" }}>
        <div style={sectionTitleStyle}>Storico certificati</div>

        {loading ? (
          <div style={{ color: "var(--muted)" }}>Caricamento...</div>
        ) : certificates.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>
            Nessun certificato medico presente.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {certificates.map((cert) => {
              const status = getCertificateStatus(cert);

              return (
                <div key={cert.id} style={certificateCard}>
                  <div>
                    <div style={certificateTitleStyle}>
                      {cert.certificate_type === "agonistico"
                        ? "Certificato agonistico"
                        : cert.certificate_type === "non_agonistico"
                        ? "Certificato non agonistico"
                        : "Certificato medico"}
                    </div>

                    <div style={smallMutedStyle}>
                      Valido dal {formatDate(cert.valid_from)} al{" "}
                      {formatDate(cert.valid_until)}
                    </div>

                    {cert.notes && <div style={mutedStyle}>{cert.notes}</div>}
                  </div>

                  <div style={rightSideStyle}>
                    <div
                      style={{
                        ...statusBadgeStyle,
                        color: status.color,
                        borderColor: status.color,
                        background: `${status.color}22`,
                      }}
                    >
                      {status.label}
                    </div>

                    <div style={actionsStyle}>
                      {cert.file_url && (
                        <a
                          href={cert.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={linkButtonStyle}
                        >
                          Apri file
                        </a>
                      )}

                      <button
                        onClick={() => deleteCertificate(cert)}
                        style={deleteButtonStyle}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "24px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: "bold",
  marginBottom: "22px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "14px",
  marginBottom: "14px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "90px",
  marginBottom: "16px",
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

const primaryButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  marginTop: "16px",
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: "bold",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  marginBottom: "16px",
};

const certificateCard: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "18px",
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "center",
  flexWrap: "wrap",
};

const certificateTitleStyle: React.CSSProperties = {
  fontWeight: "bold",
  fontSize: "18px",
};

const mutedStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "var(--muted)",
};

const smallMutedStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "var(--muted)",
  fontSize: "13px",
};

const rightSideStyle: React.CSSProperties = {
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "10px",
};

const statusBadgeStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: "bold",
  fontSize: "12px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const linkButtonStyle: React.CSSProperties = {
  color: "white",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: "12px",
  textDecoration: "none",
  fontWeight: "bold",
};

const deleteButtonStyle: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.35)",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: "bold",
  cursor: "pointer",
};