"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UpdatedMedicalCertificate = {
  url: string;
  startDate: string;
  endDate: string;
  status: "valid" | "expired";
  customer?: any;
};

type Props = {
  customerId: string;
  currentCertificateUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  onUpdated?: (data: UpdatedMedicalCertificate) => void;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function addOneYearDateOnly(value: string) {
  if (!isValidDateOnly(value)) return "";

  const [year, month, day] = value.split("-").map(Number);
  const nextYearDate = new Date(year + 1, month - 1, day);

  return [
    String(nextYearDate.getFullYear()).padStart(4, "0"),
    String(nextYearDate.getMonth() + 1).padStart(2, "0"),
    String(nextYearDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function MedicalCertificateCard({
  customerId,
  currentCertificateUrl,
  startDate,
  endDate,
  onUpdated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousStartDateRef = useRef(startDate || "");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [certificateUrl, setCertificateUrl] = useState(currentCertificateUrl || "");
  const [certificateStartDate, setCertificateStartDate] = useState(startDate || "");
  const [certificateEndDate, setCertificateEndDate] = useState(endDate || "");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const isValid = certificateEndDate && certificateEndDate >= today;

  useEffect(() => {
    setCertificateUrl(currentCertificateUrl || "");
  }, [currentCertificateUrl]);

  useEffect(() => {
    setCertificateStartDate(startDate || "");
    previousStartDateRef.current = startDate || "";
  }, [startDate]);

  useEffect(() => {
    setCertificateEndDate(endDate || "");
  }, [endDate]);

  function handleStartDateChange(value: string) {
    setCertificateStartDate(value);
    setSuccessMessage("");
    setErrorMessage("");

    const previousStartDate = previousStartDateRef.current;
    const previousAutomaticEndDate = previousStartDate
      ? addOneYearDateOnly(previousStartDate)
      : "";
    const nextAutomaticEndDate = addOneYearDateOnly(value);

    if (
      nextAutomaticEndDate &&
      (!certificateEndDate || certificateEndDate === previousAutomaticEndDate)
    ) {
      setCertificateEndDate(nextAutomaticEndDate);
    }

    previousStartDateRef.current = value;
  }

  function handleEndDateChange(value: string) {
    setCertificateEndDate(value);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setErrorMessage("");
      setSuccessMessage("");

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
      setSuccessMessage("File certificato caricato. Salva per aggiornare la scheda cliente.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Errore upload certificato");
    } finally {
      setUploading(false);
    }
  }

  async function saveCertificate() {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (!certificateStartDate || !certificateEndDate) {
        setErrorMessage("Inserisci data inizio e data fine validità del certificato.");
        return;
      }

      setSaving(true);

      const response = await fetch("/api/customers/update-medical-certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          medical_certificate_url: certificateUrl || null,
          medical_certificate_start_date: certificateStartDate,
          medical_certificate_end_date: certificateEndDate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Errore salvataggio certificato");
      }

      const updatedCustomer = result.customer || {};
      const updatedUrl = updatedCustomer.medical_certificate_url || certificateUrl || "";
      const updatedStartDate =
        updatedCustomer.medical_certificate_start_date || certificateStartDate;
      const updatedEndDate = updatedCustomer.medical_certificate_end_date || certificateEndDate;
      const updatedStatus =
        updatedCustomer.medical_certificate_status ||
        (updatedEndDate >= today ? "valid" : "expired");

      setCertificateUrl(updatedUrl);
      setCertificateStartDate(updatedStartDate);
      setCertificateEndDate(updatedEndDate);
      previousStartDateRef.current = updatedStartDate;
      setSuccessMessage("Certificato medico aggiornato correttamente");

      if (onUpdated) {
        onUpdated({
          url: updatedUrl,
          startDate: updatedStartDate,
          endDate: updatedEndDate,
          status: updatedStatus,
          customer: updatedCustomer,
        });
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Errore salvataggio certificato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="certificate-card">
      <style jsx>{`
        .certificate-card {
          background: linear-gradient(135deg, #141414, #080808);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        .header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
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
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.04em;
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

        .microcopy {
          margin-top: 18px;
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(239, 68, 68, 0.08);
          border-radius: 18px;
          padding: 12px 14px;
          color: #f5f5f5;
          font-size: 13px;
          line-height: 1.5;
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

        input:focus {
          border-color: rgba(239, 68, 68, 0.75);
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
        }

        .upload-area {
          margin-top: 22px;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-top: 16px;
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

        .upload-btn:disabled,
        .save-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .upload-btn:hover:not(:disabled),
        .save-btn:hover:not(:disabled),
        .view-btn:hover {
          transform: translateY(-1px);
        }

        .save-btn {
          width: 100%;
          background: white;
          color: black;
        }

        .view-btn {
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

        .feedback {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .error {
          color: #fb7185;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .success {
          color: #4ade80;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        input[type="file"] {
          display: none;
        }

        @media (max-width: 900px) {
          .header-row {
            flex-direction: column;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="header-row">
        <div>
          <h3>Certificato Medico</h3>
          <div className="subtitle">Gestione validità certificato cliente</div>
        </div>

        <div className={`status ${isValid ? "valid" : "expired"}`}>
          {isValid ? "CERTIFICATO VALIDO" : "CERTIFICATO SCADUTO"}
        </div>
      </div>

      <div className="microcopy">
        La scadenza viene proposta automaticamente a 12 mesi dalla data di inizio,
        ma puoi modificarla.
      </div>

      <div className="grid">
        <div className="field">
          <label>Data inizio</label>
          <input
            type="date"
            value={certificateStartDate}
            onChange={(event) => handleStartDateChange(event.target.value)}
          />
        </div>

        <div className="field">
          <label>Data fine</label>
          <input
            type="date"
            value={certificateEndDate}
            onChange={(event) => handleEndDateChange(event.target.value)}
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

        <div className="actions">
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || saving}
          >
            {uploading ? "Caricamento..." : "Carica certificato"}
          </button>

          {certificateUrl && (
            <button className="view-btn" onClick={() => window.open(certificateUrl, "_blank")}>
              Apri certificato
            </button>
          )}

          <button className="save-btn" onClick={saveCertificate} disabled={saving || uploading}>
            {saving ? "Salvataggio..." : "Salva certificato"}
          </button>
        </div>

        <div className="hint">PDF, JPG o PNG</div>

        {successMessage && <div className="feedback success">{successMessage}</div>}
        {errorMessage && <div className="feedback error">{errorMessage}</div>}
      </div>
    </div>
  );
}
