"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type TimelineItem = {
  id: string;
  customer_id: string;
  type: string;
  title: string;
  description?: string | null;
  created_at: string;
};

type Props = {
  customerId: string;
};

export default function CustomerTimeline({ customerId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadTimeline() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_timeline")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Errore timeline:", error);
      setItems([]);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case "subscription":
        return "Abbonamento";
      case "membership":
        return "Quota";
      case "payment":
        return "Pagamento";
      case "access":
        return "Accesso";
      case "block":
        return "Blocco";
      case "note":
        return "Nota";
      case "medical_certificate":
        return "Certificato";
      default:
        return "Evento";
    }
  }

  function getDotClass(type: string) {
    switch (type) {
      case "subscription":
      case "membership":
      case "payment":
        return "green";
      case "access":
        return "blue";
      case "block":
        return "red";
      case "medical_certificate":
        return "yellow";
      case "note":
        return "purple";
      default:
        return "gray";
    }
  }

  return (
    <div className="timeline-card">
      <style jsx>{`
        .timeline-card {
          background: linear-gradient(135deg, #141414, #080808);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
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

        .refresh {
          border: 1px solid #303030;
          background: #171717;
          color: white;
          border-radius: 14px;
          padding: 11px 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .refresh:hover {
          background: #262626;
        }

        .timeline {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .item {
          position: relative;
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 14px;
          padding: 14px;
          background: #080808;
          border: 1px solid #262626;
          border-radius: 18px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          margin-top: 6px;
          box-shadow: 0 0 18px currentColor;
        }

        .green {
          background: #22c55e;
          color: #22c55e;
        }

        .blue {
          background: #38bdf8;
          color: #38bdf8;
        }

        .red {
          background: #ef4444;
          color: #ef4444;
        }

        .yellow {
          background: #facc15;
          color: #facc15;
        }

        .purple {
          background: #a855f7;
          color: #a855f7;
        }

        .gray {
          background: #737373;
          color: #737373;
        }

        .type {
          display: inline-flex;
          width: fit-content;
          padding: 5px 9px;
          border-radius: 999px;
          background: #171717;
          border: 1px solid #303030;
          color: #a3a3a3;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .title {
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
        }

        .description {
          margin-top: 5px;
          color: #a3a3a3;
          font-size: 13px;
          line-height: 1.5;
        }

        .date {
          margin-top: 8px;
          color: #737373;
          font-size: 12px;
          font-weight: 700;
        }

        .empty,
        .loading {
          color: #737373;
          font-size: 14px;
          padding: 10px 0;
        }
      `}</style>

      <div className="header">
        <div>
          <h3>Timeline attività</h3>
          <div className="subtitle">
            Storico operativo del cliente
          </div>
        </div>

        <button className="refresh" onClick={loadTimeline}>
          Aggiorna
        </button>
      </div>

      {loading && <div className="loading">Caricamento timeline...</div>}

      {!loading && items.length === 0 && (
        <div className="empty">Nessuna attività registrata.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="timeline">
          {items.map((item) => (
            <div className="item" key={item.id}>
              <div className={`dot ${getDotClass(item.type)}`} />

              <div>
                <div className="type">{getTypeLabel(item.type)}</div>

                <div className="title">{item.title}</div>

                {item.description && (
                  <div className="description">{item.description}</div>
                )}

                <div className="date">
                  {new Date(item.created_at).toLocaleString("it-IT")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}