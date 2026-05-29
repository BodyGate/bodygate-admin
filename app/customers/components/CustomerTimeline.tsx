"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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
  badgeColor: "green" | "blue" | "red" | "yellow" | "purple" | "gray";
};

type Props = {
  customerId: string;
};

const MAX_ITEMS_PER_SOURCE = 80;
const MAX_TOTAL_ITEMS = 200;

export default function CustomerTimeline({ customerId }: Props) {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function safeSelect<T = any>(table: string, queryBuilder: (qb: any) => any) {
    try {
      const base = supabase.from(table);
      const q = queryBuilder(base);
      const { data, error } = await q;
      if (error) {
        console.warn(`[Timeline] source non disponibile: ${table}`, error.message);
        return [] as T[];
      }
      return (data || []) as T[];
    } catch (error) {
      console.warn(`[Timeline] errore fallback su tabella ${table}`, error);
      return [] as T[];
    }
  }

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

    const customers = await safeSelect<any>("customers", (qb) =>
      qb
        .select("id, badge_code, first_name, last_name")
        .eq("id", customerId)
        .limit(1)
    );

    const customer = customers[0] || null;
    const directBadgeCode = customer?.badge_code || null;

    const customerBadges = await safeSelect<any>("customer_badges", (qb) =>
      qb
        .select("id, badge_code, badge_type, is_primary, is_active, notes, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    const accessCredentials = await safeSelect<any>("access_credentials", (qb) =>
      qb
        .select("id, type, code, status, created_at, controller_code")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    const badgeCodes = new Set<string>();
    if (directBadgeCode) badgeCodes.add(String(directBadgeCode));
    customerBadges.forEach((b) => {
      if (b?.badge_code) badgeCodes.add(String(b.badge_code));
    });
    accessCredentials.forEach((c) => {
      if (c?.code) badgeCodes.add(String(c.code));
      if (c?.controller_code) badgeCodes.add(String(c.controller_code));
    });

    const [
      customerAccessLogs,
      subscriptions,
      membershipFees,
      medicalCertificates,
      blocks,
      notes,
      payments,
      customerPayments,
      customerDocuments,
      documents,
      timelineLegacy,
    ] = await Promise.all([
      safeSelect<any>("customer_access_logs", (qb) =>
        qb
          .select("id, created_at, access_time, badge_code, controller_code, was_allowed, reason")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_subscriptions", (qb) =>
        qb
          .select("id, created_at, starts_at, ends_at, is_active, amount, payment_method, notes, plan_id")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_membership_fees", (qb) =>
        qb
          .select("id, created_at, paid_at, valid_from, valid_until, amount, payment_method, notes")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("medical_certificates", (qb) =>
        qb
          .select("id, created_at, valid_from, valid_until, expiry_date, status, certificate_type, notes, file_name")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_blocks", (qb) =>
        qb
          .select("id, created_at, starts_at, ends_at, is_active, reason")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_internal_notes", (qb) =>
        qb
          .select("id, created_at, note, is_important, created_by")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("payments", (qb) =>
        qb
          .select("id, created_at, paid_at, amount, status, payment_type, description")
          .eq("customer_id", customerId)
          .order("paid_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_payments", (qb) =>
        qb
          .select("id, created_at, paid_at, amount, type, description, payment_method")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_documents", (qb) =>
        qb
          .select("id, created_at, title, type, document_type, status, notes")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("documents", (qb) =>
        qb
          .select("id, created_at, title, type, file_name, status, signed_at, expires_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>("customer_timeline", (qb) =>
        qb
          .select("id, created_at, type, title, description")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
    ]);

    const technicalAccessByCustomerId = await safeSelect<any>("access_logs", (qb) =>
      qb
        .select("id, created_at, badge_code, controller_code, allowed, reason, event_type")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    let technicalAccessByBadge: any[] = [];
    const badgeArray = Array.from(badgeCodes);
    if (badgeArray.length > 0) {
      technicalAccessByBadge = await safeSelect<any>("access_logs", (qb) =>
        qb
          .select("id, created_at, badge_code, controller_code, allowed, reason, event_type")
          .or(
            `badge_code.in.(${badgeArray.map((b) => `"${b}"`).join(",")}),controller_code.in.(${badgeArray
              .map((b) => `"${b}"`)
              .join(",")})`
          )
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      );
    }

    const eventList: TimelineEvent[] = [
      ...customerAccessLogs.map((log) => ({
        id: `customer_access_${log.id}`,
        source: "customer_access_logs",
        type: "customer_access" as const,
        title: log.was_allowed ? "Accesso consentito" : "Accesso negato",
        description: [
          log.badge_code || log.controller_code ? `Codice: ${log.badge_code || log.controller_code}` : null,
          !log.was_allowed ? `Motivo: ${log.reason || "non specificato"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(log, ["access_time", "created_at"]),
        status: buildStatusLabel(log.was_allowed ? "consentito" : "negato"),
        badgeColor: log.was_allowed ? "green" : "red",
      })),
      ...[...technicalAccessByCustomerId, ...technicalAccessByBadge].map((log) => ({
        id: `technical_access_${log.id}`,
        source: "access_logs",
        type: "technical_access" as const,
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
        badgeColor: log.allowed ? "blue" : "red",
      })),
      ...subscriptions.map((sub) => ({
        id: `subscription_${sub.id}`,
        source: "customer_subscriptions",
        type: "subscription" as const,
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
        badgeColor: "green" as const,
      })),
      ...membershipFees.map((fee) => ({
        id: `membership_${fee.id}`,
        source: "customer_membership_fees",
        type: "membership_fee" as const,
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
        badgeColor: "yellow" as const,
      })),
      ...medicalCertificates.map((cert) => {
        const startDate = cert.valid_from;
        const endDate = cert.valid_until || cert.expiry_date;
        return {
          id: `medical_${cert.id}`,
          source: "medical_certificates",
          type: "medical_certificate" as const,
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
          badgeColor: "purple" as const,
        };
      }),
      ...blocks.map((block) => ({
        id: `block_${block.id}`,
        source: "customer_blocks",
        type: "block" as const,
        title: block.is_active ? "Cliente bloccato" : "Storico blocco cliente",
        description: [
          block.reason ? `Motivo: ${block.reason}` : null,
          block.starts_at || block.ends_at ? `Periodo: ${block.starts_at || "-"} → ${block.ends_at || "-"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(block, ["created_at", "starts_at"]),
        status: buildStatusLabel(block.is_active ? "attivo" : "chiuso"),
        badgeColor: block.is_active ? "red" : "gray",
      })),
      ...notes.map((note) => ({
        id: `note_${note.id}`,
        source: "customer_internal_notes",
        type: "note" as const,
        title: note.is_important ? "Nota importante" : "Nota interna",
        description: note.note || "Nota operativa cliente",
        createdAt: pickDate(note, ["created_at"]),
        status: buildStatusLabel(note.is_important ? "importante" : null),
        badgeColor: note.is_important ? "yellow" : "blue",
      })),
      ...payments.map((payment) => ({
        id: `payment_${payment.id}`,
        source: "payments",
        type: "payment" as const,
        title: "Pagamento registrato",
        description: payment.description || `Tipo: ${payment.payment_type || "N/D"}`,
        createdAt: pickDate(payment, ["paid_at", "created_at"]),
        amount: payment.amount ?? null,
        status: buildStatusLabel(payment.status),
        badgeColor: "green" as const,
      })),
      ...customerPayments.map((payment) => ({
        id: `customer_payment_${payment.id}`,
        source: "customer_payments",
        type: "payment" as const,
        title: "Pagamento cliente",
        description: payment.description || `Tipo: ${payment.type || "N/D"}${payment.payment_method ? ` · ${payment.payment_method}` : ""}`,
        createdAt: pickDate(payment, ["paid_at", "created_at"]),
        amount: payment.amount ?? null,
        status: buildStatusLabel(payment.payment_method),
        badgeColor: "green" as const,
      })),
      ...customerDocuments.map((doc) => ({
        id: `customer_document_${doc.id}`,
        source: "customer_documents",
        type: "document" as const,
        title: "Documento cliente",
        description: `${doc.title || "Documento"}${doc.document_type || doc.type ? ` · Tipo: ${doc.document_type || doc.type}` : ""}`,
        createdAt: pickDate(doc, ["created_at"]),
        status: buildStatusLabel(doc.status),
        badgeColor: "gray" as const,
      })),
      ...documents.map((doc) => ({
        id: `document_${doc.id}`,
        source: "documents",
        type: "document" as const,
        title: "Documento caricato",
        description: `${doc.title || doc.file_name || "Documento"}${doc.type ? ` · Tipo: ${doc.type}` : ""}`,
        createdAt: pickDate(doc, ["signed_at", "created_at", "expires_at"]),
        status: buildStatusLabel(doc.status),
        badgeColor: "gray" as const,
      })),
      ...customerBadges.map((credential) => ({
        id: `badge_${credential.id}`,
        source: "customer_badges",
        type: "access_credential" as const,
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
        badgeColor: credential.is_active ? "blue" : "gray",
      })),
      ...accessCredentials.map((credential) => ({
        id: `access_credential_${credential.id}`,
        source: "access_credentials",
        type: "access_credential" as const,
        title: credential.type === "qr" ? "QR DNake associato" : "Credenziale accesso",
        description: [
          `Codice: ${credential.type === "qr" ? credential.controller_code || credential.code : credential.code || "N/D"}`,
          credential.type ? `Tipo: ${credential.type}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: pickDate(credential, ["created_at"]),
        status: buildStatusLabel(credential.status),
        badgeColor: credential.status === "active" ? "blue" : "gray",
      })),
      ...timelineLegacy.map((item) => ({
        id: `legacy_timeline_${item.id}`,
        source: "customer_timeline",
        type: "generic" as const,
        title: item.title || "Evento storico",
        description: item.description || `Tipo: ${item.type || "N/D"}`,
        createdAt: pickDate(item, ["created_at"]),
        status: buildStatusLabel(item.type),
        badgeColor: "gray" as const,
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
        .timeline-card { background: linear-gradient(140deg, #121212, #090909); border: 1px solid #252525; border-radius: 24px; padding: 24px; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);} 
        .header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
        h3 { margin:0; color:#fff; font-size:22px; font-weight:900; }
        .subtitle { margin-top:6px; color:#a3a3a3; font-size:13px; }
        .refresh { border:1px solid #333; background:#171717; color:#fff; border-radius:12px; padding:10px 14px; font-weight:800; cursor:pointer; }
        .refresh:hover { background:#222; }
        .stats { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
        .pill { padding:6px 10px; border-radius:999px; border:1px solid #313131; color:#cfcfcf; background:#101010; font-size:11px; font-weight:800; }
        .timeline { display:flex; flex-direction:column; gap:12px; }
        .item { display:grid; grid-template-columns:16px 1fr; gap:12px; background:#0b0b0b; border:1px solid #232323; border-radius:16px; padding:14px; }
        .dot { width:10px; height:10px; border-radius:999px; margin-top:6px; box-shadow:0 0 16px currentColor; }
        .green { background:#22c55e; color:#22c55e; } .blue { background:#38bdf8; color:#38bdf8; } .red { background:#ef4444; color:#ef4444; } .yellow { background:#facc15; color:#facc15; } .purple { background:#a855f7; color:#a855f7; } .gray { background:#737373; color:#737373; }
        .meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:6px; }
        .type { display:inline-flex; padding:4px 8px; border-radius:999px; background:#171717; border:1px solid #303030; color:#d4d4d4; font-size:10px; font-weight:900; text-transform:uppercase; }
        .status { display:inline-flex; padding:4px 8px; border-radius:999px; background:#0f172a; border:1px solid #1e3a8a; color:#bfdbfe; font-size:10px; font-weight:900; text-transform:uppercase; }
        .amount { color:#86efac; font-size:12px; font-weight:800; }
        .title { color:#fff; font-size:15px; font-weight:900; }
        .description { margin-top:4px; color:#a3a3a3; font-size:13px; line-height:1.45; }
        .date { margin-top:8px; color:#737373; font-size:12px; font-weight:700; }
        .empty,.loading { color:#737373; font-size:14px; padding:8px 0; }
      `}</style>

      <div className="header">
        <div>
          <h3>Timeline cliente V1</h3>
          <div className="subtitle">Storico operativo unificato (eventi CRM, accessi, economico e documentale)</div>
        </div>
        <button className="refresh" onClick={loadTimeline}>Aggiorna</button>
      </div>

      {!loading && items.length > 0 && (
        <div className="stats">
          {Object.entries(groupedCount).map(([type, count]) => (
            <span className="pill" key={type}>{type}: {count}</span>
          ))}
        </div>
      )}

      {loading && <div className="loading">Caricamento timeline...</div>}
      {!loading && items.length === 0 && <div className="empty">Nessuna attività registrata o fonti non disponibili.</div>}

      {!loading && items.length > 0 && (
        <div className="timeline">
          {items.map((item) => (
            <div className="item" key={item.id}>
              <div className={`dot ${item.badgeColor}`} />
              <div>
                <div className="meta">
                  <span className="type">{item.type.replaceAll("_", " ")}</span>
                  {item.status && <span className="status">{item.status}</span>}
                  {typeof item.amount === "number" && <span className="amount">€ {Number(item.amount).toFixed(2)}</span>}
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
