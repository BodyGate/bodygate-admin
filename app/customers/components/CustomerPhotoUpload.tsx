"use client";

import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  customerId: string;
  currentPhotoUrl?: string | null;
  onUploaded?: (url: string) => void;
};

export default function CustomerPhotoUpload({
  customerId,
  currentPhotoUrl,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setErrorMessage("");

      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${customerId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("customer-photos")
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("customers")
        .update({ photo_url: publicUrl })
        .eq("id", customerId);

      if (updateError) throw updateError;

      setPreview(publicUrl);
      onUploaded?.(publicUrl);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Errore upload foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="photo-card">
      <style jsx>{`
        .photo-card {
          height: 100%;
          min-height: 330px;
          background: linear-gradient(135deg, #141414, #080808);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .title {
          width: 100%;
          text-align: left;
          margin-bottom: 18px;
        }

        h3 {
          margin: 0;
          color: #ffffff;
          font-size: 20px;
          font-weight: 900;
        }

        p {
          margin: 6px 0 0;
          color: #a3a3a3;
          font-size: 14px;
        }

        .avatar-wrap {
          width: 170px;
          height: 170px;
          border-radius: 34px;
          padding: 4px;
          background: linear-gradient(135deg, #ef4444, #7f1d1d, #262626);
          margin: 10px 0 20px;
        }

        .avatar-box {
          width: 100%;
          height: 100%;
          border-radius: 30px;
          overflow: hidden;
          background: #050505;
          border: 1px solid #262626;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .empty-photo {
          color: #737373;
          font-size: 13px;
          font-weight: 800;
        }

        input {
          display: none;
        }

        button {
          width: 100%;
          border: none;
          border-radius: 16px;
          padding: 14px 18px;
          background: #ef4444;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.2s;
        }

        button:hover {
          transform: translateY(-1px);
          background: #f87171;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .hint {
          margin-top: 12px;
          color: #737373;
          font-size: 12px;
        }

        .error {
          margin-top: 12px;
          color: #fb7185;
          font-size: 13px;
          font-weight: 700;
        }
      `}</style>

      <div className="title">
        <h3>Foto Cliente</h3>
        <p>Profilo visivo del cliente</p>
      </div>

      <div className="avatar-wrap">
        <div className="avatar-box">
          {preview ? (
            <img src={preview} alt="Foto cliente" />
          ) : (
            <div className="empty-photo">NESSUNA FOTO</div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
      />

      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? "Caricamento..." : "Carica nuova foto"}
      </button>

      <div className="hint">Formato consigliato: JPG o PNG quadrata</div>

      {errorMessage && <div className="error">{errorMessage}</div>}
    </div>
  );
}