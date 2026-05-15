"use client";

import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  customerId: string;
  currentCertificateUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  onUpdated?: (data: {
    url: string;
    startDate: string;
    endDate: string;
  }) => void;
};

export default function MedicalCertificateCard({
  customerId,
  currentCertificateUrl,
  startDate,
  endDate,
  onUpdated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);

  const [certificateUrl, setCertificateUrl] = useState(
    currentCertificateUrl || ""
  );

  const [certificateStartDate, setCertificateStartDate] = useState(
    startDate || ""
  );

  const [certificateEndDate, setCertificateEndDate] = useState(
    endDate || ""
  );

  const [errorMessage, setErrorMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const isValid =
    certificateEndDate && certificateEndDate >= today;

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      setErrorMessage("");

      const file = event.target.files?.[0];

      if (!file) return;

      setUploading(true);

      const fileExt = file.name.split(".").pop();

      const fileName = `${customerId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("medical-certificates")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("medical-certificates")
        .getPublicUrl(fileName);

      setCertificateUrl(data.publicUrl);
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message || "Errore upload certificato"
      );
    } finally {
      setUploading(false);
    }
  }

  async function saveCertificate() {
    try {
      setErrorMessage("");

      if (!certificateStartDate || !certificateEndDate) {
        return alert("Inserisci le date.");
      }

      const status =
        certificateEndDate >= today ? "valid" : "expired";

      const { error } = await supabase
        .from("customers")
        .update({
          medical_certificate_url: certificateUrl,
          medical_certificate_start_date:
            certificateStartDate,
          medical_certificate_end_date:
            certificateEndDate,
          medical_certificate_status: status,
        })
        .eq("id", customerId);

      if (error) {
        throw error;
      }

      if (onUpdated) {
        onUpdated({
          url: certificateUrl,
          startDate: certificateStartDate,
          endDate: certificateEndDate,
        });
      }

      alert("Certificato aggiornato.");
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Errore salvataggio certificato"
      );
    }
  }

  return (
    <div className="certificate-card">
      <style jsx>{`
        .certificate-card {
          background: linear-gradient(
            135deg,
            #141414,
            #080808
          );
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        h3 {
          margin: 0;
          color: #ffffff;
          font-size: 22px;
          font-weight: 900;
        }

        .subtitle {
          margin-top: 6px;
          color: #a3a3a3;
          font-size: 14px;
        }

        .status {
          margin-top: 18px;
          display: inline-flex;
          align-items: center;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
        }

        .valid {
          background: rgba(34, 197, 94, 0.14);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.35);
        }

        .expired {
          background: rgba(239, 68, 68, 0.14);
          color: #fb7185;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 22px;
        }

        .field {
          display: flex;
          flex-direction: column;
        }

        label {
          margin-bottom: 8px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }

        input {
          background: #050505;
          border: 1px solid #303030;
          border-radius: 14px;
          padding: 14px;
          color: white;
          font-size: 14px;
          outline: none;
        }

        .upload-area {
          margin-top: 22px;
        }

        .upload-btn,
        .save-btn,
        .view-btn {
          border: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.2s;
        }

        .upload-btn {
          background: #ef4444;
          color: white;
          width: 100%;
        }

        .upload-btn:hover,
        .save-btn:hover,
        .view-btn:hover {
          transform: translateY(-1px);
        }

        .save-btn {
          margin-top: 20px;
          width: 100%;
          background: white;
          color: black;
        }

        .view-btn {
          margin-top: 16px;
          width: 100%;
          background: #171717;
          color: white;
          border: 1px solid #303030;
        }

        .hint {
          margin-top: 10px;
          color: #737373;
          font-size: 12px;
        }

        .error {
          margin-top: 12px;
          color: #fb7185;
          font-size: 13px;
          font-weight: 700;
        }

        input[type="file"] {
          display: none;
        }

        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <h3>Certificato Medico</h3>

      <div className="subtitle">
        Gestione validità certificato cliente
      </div>

      <div
        className={`status ${
          isValid ? "valid" : "expired"
        }`}
      >
        {isValid
          ? "CERTIFICATO VALIDO"
          : "CERTIFICATO SCADUTO"}
      </div>

      <div className="grid">
        <div className="field">
          <label>Data inizio</label>

          <input
            type="date"
            value={certificateStartDate}
            onChange={(e) =>
              setCertificateStartDate(e.target.value)
            }
          />
        </div>

        <div className="field">
          <label>Data fine</label>

          <input
            type="date"
            value={certificateEndDate}
            onChange={(e) =>
              setCertificateEndDate(e.target.value)
            }
          />
        </div>
      </div>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={handleUpload}
        />

        <button
          className="upload-btn"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={uploading}
        >
          {uploading
            ? "Caricamento..."
            : "Carica certificato"}
        </button>

        <div className="hint">
          PDF, JPG o PNG
        </div>

        {certificateUrl && (
          <button
            className="view-btn"
            onClick={() =>
              window.open(certificateUrl, "_blank")
            }
          >
            Apri certificato
          </button>
        )}

        <button
          className="save-btn"
          onClick={saveCertificate}
        >
          Salva certificato
        </button>

        {errorMessage && (
          <div className="error">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}