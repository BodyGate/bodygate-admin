"use client";

import { useEffect, useMemo, useState } from "react";

type BadgeColor = "green" | "blue" | "red" | "yellow" | "purple" | "gray";

type TimelineEventType =
  | "customer_access"
  | "technical_access"
  | "subscription"
  | "membership_fee"
  | "medical_certificate"
  | "block"
  | "note"
  | "payment"
  | "document"
  | "access_credential"
  | "generic";

type TimelineEvent = {
  id: string;
  source: string;
  type: TimelineEventType;
  title: string;
  description: string;
  createdAt: string;
  amount?: number | null;
  status?: string | null;
  badgeColor: BadgeColor;
};

type Props = {
  customerId: string;
};

const MAX_TOTAL_ITEMS = 200;

function asBadgeColor(color: BadgeColor): BadgeColor {
  return color;
}

export default function CustomerTimeline({ customerId }: Props) {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function pickDate(item: any, fields: string[]) {
    for (const field of fields) {
      const value = item?.[field];
      if (typeof value === "string" && value) return value;
    }

    return new Date(0).toISOString();
  }

  function buildStatusLabel(value: any): string | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value ? "attivo" : "inattivo";
    return String(value);
  }

  async function loadTimeline() {
    setLoading(true);

    const response = await fetch(
      `/api/customers/${encodeURIComponent(customerId)}/timeline-feed`,
      { cache: "no-store" },
    );
    const feed = await response.json().catch(() => null);

    if (!response.ok || !feed?.ok) {
      console.warn("[Timeline] errore caricamento feed", feed?.error);
      setItems([]);
      setLoading(false);
      return;
    }

    const {
      customerAccessLogs,
      technicalAccessByCustomerId,
      technicalAccessByBadge,
      subscriptions,
      membershipFees,
      medicalCertificates,
      blocks,
      notes,
      payments,
      customerPayments,
      customerDocuments,
      documents,
      customerBadges,
      accessCredentials,
      timelineLegacy,
    } = feed;

    const eventList: TimelineEvent[] = [
      ...customerAccessLogs.map((log: any): TimelineEvent => ({
        id: `customer_access_${log.id}`,
        source: "customer_access_logs",
        type: "customer_access",
        title: log.was_allowed ? "Accesso consentito" : "Accesso negato",
        description: [
          log.badge_code || log.controller_code ? `Codice: ${log.badge_code || log.controller_code}` : null,
          !log.was_allowed ? `Motivo: ${log.reason || "non specificato"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(log, ["access_time", "created_at"]),
        status: buildStatusLabel(log.was_allowed ? "consentito" : "negato"),
        badgeColor: asBadgeColor(log.was_allowed ? "green" : "red"),
      })),

      ...[...technicalAccessByCustomerId, ...technicalAccessByBadge].map((log: any): TimelineEvent => ({
        id: `technical_access_${log.id}`,
        source: "access_logs",
        type: "technical_access",
        title: log.allowed ? "Log tecnico accesso consentito" : "Log tecnico accesso negato",
        description: [
          log.badge_code || log.controller_code ? `Codice: ${log.badge_code || log.controller_code}` : null,
          log.event_type ? `Evento: ${log.event_type}` : null,
          !log.allowed ? `Motivo: ${log.reason || "non specificato"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(log, ["created_at"]),
        status: buildStatusLabel(log.allowed ? "consentito" : "negato"),
        badgeColor: asBadgeColor(log.allowed ? "blue" : "red"),
      })),

      ...subscriptions.map((sub: any): TimelineEvent => ({
        id: `subscription_${sub.id}`,
        source: "customer_subscriptions",
        type: "subscription",
        title: "Abbonamento cliente",
        description: [
          `Periodo: ${sub.starts_at || "-"} → ${sub.ends_at || "-"}`,
          sub.payment_method ? `Pagamento: ${sub.payment_method}` : null,
          sub.notes ? `Note: ${sub.notes}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(sub, ["created_at", "starts_at"]),
        amount: sub.amount ?? null,
        status: buildStatusLabel(sub.is_active),
        badgeColor: "green",
      })),

      ...membershipFees.map((fee: any): TimelineEvent => ({
        id: `membership_${fee.id}`,
        source: "customer_membership_fees",
        type: "membership_fee",
        title: "Quota associativa",
        description: [
          `Validità: ${fee.valid_from || "-"} → ${fee.valid_until || "-"}`,
          fee.payment_method ? `Pagamento: ${fee.payment_method}` : null,
          fee.notes ? `Note: ${fee.notes}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(fee, ["paid_at", "created_at", "valid_from"]),
        amount: fee.amount ?? null,
        status: buildStatusLabel(fee.payment_method),
        badgeColor: "yellow",
      })),

      ...medicalCertificates.map((cert: any): TimelineEvent => {
        const startDate = cert.valid_from;
        const endDate = cert.valid_until || cert.expiry_date;

        return {
          id: `medical_${cert.id}`,
          source: "medical_certificates",
          type: "medical_certificate",
          title: "Certificato medico",
          description: [
            `Validità: ${startDate || "-"} → ${endDate || "-"}`,
            cert.certificate_type ? `Tipo: ${cert.certificate_type}` : null,
            cert.file_name ? `File: ${cert.file_name}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          createdAt: pickDate(cert, ["created_at", "valid_until", "expiry_date"]),
          status: buildStatusLabel(cert.status),
          badgeColor: "purple",
        };
      }),

      ...blocks.map((block: any): TimelineEvent => ({
        id: `block_${block.id}`,
        source: "customer_blocks",
        type: "block",
        title: block.is_active ? "Cliente bloccato" : "Storico blocco cliente",
        description: [
          block.reason ? `Motivo: ${block.reason}` : null,
          block.starts_at || block.ends_at ? `Periodo: ${block.starts_at || "-"} → ${block.ends_at || "-"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(block, ["created_at", "starts_at"]),
        status: buildStatusLabel(block.is_active ? "attivo" : "chiuso"),
        badgeColor: asBadgeColor(block.is_active ? "red" : "gray"),
      })),

      ...notes.map((note: any): TimelineEvent => ({
        id: `note_${note.id}`,
        source: "customer_internal_notes",
        type: "note",
        title: note.is_important ? "Nota importante" : "Nota interna",
        description: note.note || "Nota operativa cliente",
        createdAt: pickDate(note, ["created_at"]),
        status: buildStatusLabel(note.is_important ? "importante" : null),
        badgeColor: asBadgeColor(note.is_important ? "yellow" : "blue"),
      })),

      ...payments.map((payment: any): TimelineEvent => ({
        id: `payment_${payment.id}`,
        source: "payments",
        type: "payment",
        title: "Pagamento registrato",
        description: payment.description || `Tipo: ${payment.payment_type || "N/D"}`,
        createdAt: pickDate(payment, ["paid_at", "created_at"]),
        amount: payment.amount ?? null,
        status: buildStatusLabel(payment.status),
        badgeColor: "green",
      })),

      ...customerPayments.map((payment: any): TimelineEvent => ({
        id: `customer_payment_${payment.id}`,
        source: "customer_payments",
        type: "payment",
        title: "Pagamento cliente",
        description:
          payment.description ||
          `Tipo: ${payment.type || "N/D"}${payment.payment_method ? ` · ${payment.payment_method}` : ""}`,
        createdAt: pickDate(payment, ["paid_at", "created_at"]),
        amount: payment.amount ?? null,
        status: buildStatusLabel(payment.payment_method),
        badgeColor: "green",
      })),

      ...customerDocuments.map((doc: any): TimelineEvent => ({
        id: `customer_document_${doc.id}`,
        source: "customer_documents",
        type: "document",
        title: "Documento cliente",
        description: `${doc.title || "Documento"}${
          doc.document_type || doc.type ? ` · Tipo: ${doc.document_type || doc.type}` : ""
        }`,
        createdAt: pickDate(doc, ["created_at"]),
        status: buildStatusLabel(doc.status),
        badgeColor: "gray",
      })),

      ...documents.map((doc: any): TimelineEvent => ({
        id: `document_${doc.id}`,
        source: "documents",
        type: "document",
        title: "Documento caricato",
        description: `${doc.title || doc.file_name || "Documento"}${doc.type ? ` · Tipo: ${doc.type}` : ""}`,
        createdAt: pickDate(doc, ["signed_at", "created_at", "expires_at"]),
        status: buildStatusLabel(doc.status),
        badgeColor: "gray",
      })),

      ...customerBadges.map((credential: any): TimelineEvent => ({
        id: `badge_${credential.id}`,
        source: "customer_badges",
        type: "access_credential",
        title: "Badge associato",
        description: [
          `Codice: ${credential.badge_code || "N/D"}`,
          credential.badge_type ? `Tipo: ${credential.badge_type}` : null,
          credential.is_primary ? "Primario" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(credential, ["created_at"]),
        status: buildStatusLabel(credential.is_active),
        badgeColor: asBadgeColor(credential.is_active ? "blue" : "gray"),
      })),

      ...accessCredentials.map((credential: any): TimelineEvent => ({
        id: `access_credential_${credential.id}`,
        source: "access_credentials",
        type: "access_credential",
        title: credential.type === "qr" ? "QR DNake associato" : "Credenziale accesso",
        description: [
          `Codice: ${credential.type === "qr" ? credential.controller_code || credential.code : credential.code || "N/D"}`,
          credential.type ? `Tipo: ${credential.type}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(credential, ["created_at"]),
        status: buildStatusLabel(credential.status),
        badgeColor: asBadgeColor(credential.status === "active" ? "blue" : "gray"),
      })),

      ...timelineLegacy.map((item: any): TimelineEvent => ({
        id: `legacy_timeline_${item.id}`,
        source: "customer_timeline",
        type: "generic",
        title: item.title || "Evento storico",
        description: item.description || `Tipo: ${item.type || "N/D"}`,
        createdAt: pickDate(item, ["created_at"]),
        status: buildStatusLabel(item.type),
        badgeColor: "gray",
      })),
    ];

    const deduped = new Map<string, TimelineEvent>();

    for (const event of eventList) {
      const key = `${event.source}:${event.id}`;
      if (!deduped.has(key)) deduped.set(key, event);
    }

    const sortedItems = Array.from(deduped.values())
      .filter((item) => item.createdAt && item.createdAt !== new Date(0).toISOString())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_TOTAL_ITEMS);

    setItems(sortedItems);
    setLoading(false);
  }

  const groupedCount = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="timeline-card">
      <style jsx>{`
        .timeline-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(21, 22, 28, 0.04), 0 12px 32px -12px rgba(21, 22, 28, 0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }
        h3 {
          margin: 0;
          color: var(--text);
          font-size: 22px;
          font-weight: 900;
        }
        .subtitle {
          margin-top: 6px;
          color: var(--muted);
          font-size: 13px;
        }
        .refresh {
          border: 1px solid var(--bg-border-strong, #d7d9e3);
          background: var(--panel);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .refresh:hover {
          background: var(--bg-canvas-raised, #f4f5f9);
        }
        .stats {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--muted);
          background: var(--bg-canvas-raised, #f4f5f9);
          font-size: 11px;
          font-weight: 800;
        }
        .timeline {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .item {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 12px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-top: 6px;
          box-shadow: 0 0 16px currentColor;
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
          background: #5b3df5;
          color: #5b3df5;
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
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 6px;
        }
        .type {
          display: inline-flex;
          padding: 4px 8px;
          border-radius: 999px;
          background: var(--bg-canvas-raised, #f4f5f9);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .status {
          display: inline-flex;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(58, 107, 219, 0.1);
          border: 1px solid rgba(58, 107, 219, 0.3);
          color: #2c50a8;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .amount {
          color: #157a53;
          font-size: 12px;
          font-weight: 800;
        }
        .title {
          color: var(--text);
          font-size: 15px;
          font-weight: 900;
        }
        .description {
          margin-top: 4px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .date {
          margin-top: 8px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .empty,
        .loading {
          color: var(--muted);
          font-size: 14px;
          padding: 8px 0;
        }
      `}</style>

      <div className="header">
        <div>
          <h3>Timeline cliente V1</h3>
          <div className="subtitle">Storico operativo unificato eventi CRM, accessi, economico e documentale</div>
        </div>
        <button className="refresh" onClick={loadTimeline}>
          Aggiorna
        </button>
      </div>

      {!loading && items.length > 0 && (
        <div className="stats">
          {Object.entries(groupedCount).map(([type, count]) => (
            <span className="pill" key={type}>
              {type}: {count}
            </span>
          ))}
        </div>
      )}

      {loading && <div className="loading">Caricamento timeline...</div>}

      {!loading && items.length === 0 && (
        <div className="empty">Nessuna attività registrata o fonti non disponibili.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="timeline">
          {items.map((item) => (
            <div className="item" key={item.id}>
              <div className={`dot ${item.badgeColor}`} />
              <div>
                <div className="meta">
                  <span className="type">{item.type.replaceAll("_", " ")}</span>
                  {item.status && <span className="status">{item.status}</span>}
                  {typeof item.amount === "number" && (
                    <span className="amount">€ {Number(item.amount).toFixed(2)}</span>
                  )}
                </div>

                <div className="title">{item.title}</div>
                <div className="description">{item.description || "-"}</div>
                <div className="date">{new Date(item.createdAt).toLocaleString("it-IT")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}