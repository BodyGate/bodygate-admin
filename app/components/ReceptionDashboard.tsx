"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AccessEvent = {
  id: string;
  access_time: string;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  was_allowed: boolean;
  reason: string | null;
  customers?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

type PresenceRecord = {
  id: string;
  customer_id: string | null;
  badge_code: string | null;
  entered_at: string;
  is_inside: boolean;
  customers?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export default function ReceptionDashboard() {
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [presence, setPresence] = useState<PresenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  function getName(item?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null) {
    if (!item) return "Cliente sconosciuto";
    const full = item.full_name?.trim();
    const firstLast = `${item.first_name || ""} ${item.last_name || ""}`.trim();
    return full || firstLast || "Cliente sconosciuto";
  }

  async function loadData({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true);

    const [{ data: eventData }, { data: presenceData }] = await Promise.all([
      supabase
        .from("customer_access_logs")
        .select(
          `id, access_time, customer_id, badge_code, controller_code, was_allowed, reason, customers (full_name, first_name, last_name)`
        )
        .order("access_time", { ascending: false })
        .limit(40),
      supabase
        .from("gym_presence")
        .select(
          `id, customer_id, badge_code, entered_at, is_inside, customers (full_name, first_name, last_name)`
        )
        .eq("is_inside", true)
        .order("entered_at", { ascending: false })
        .limit(30),
    ]);

    setEvents((eventData || []) as AccessEvent[]);
    setPresence((presenceData || []) as PresenceRecord[]);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });

    const accessChannel = supabase
      .channel("reception_customer_access_live_v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_access_logs" },
        () => loadData({ silent: true })
      )
      .subscribe();

    const presenceChannel = supabase
      .channel("reception_gym_presence_live_v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gym_presence" },
        () => loadData({ silent: true })
      )
      .subscribe();

    const polling = window.setInterval(() => {
      loadData({ silent: true });
      setNowMs(Date.now());
    }, 7000);

    return () => {
      window.clearInterval(polling);
      supabase.removeChannel(accessChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const deniedEvents = useMemo(() => events.filter((item) => !item.was_allowed), [events]);
  const latestEvent = events[0];

  return (
    <main style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>BodyGate Reception Dashboard Live V1</div>
          <h1 style={titleStyle}>Access Feed + Presenza Attuale</h1>
        </div>
        <div style={liveBadgeStyle}>● LIVE</div>
      </div>

      <div style={statsGridStyle}>
        <InfoCard title="Accessi recenti" value={String(events.length)} note="ultimi 40 eventi" />
        <InfoCard title="Accessi negati" value={String(deniedEvents.length)} note="segnalazioni operative" />
        <InfoCard title="Presenti ora" value={String(presence.length)} note="gym_presence.is_inside=true" />
      </div>

      {latestEvent && (
        <div style={latestPanelStyle}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#8ea0bb" }}>ULTIMO INGRESSO</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>{getName(latestEvent.customers)}</div>
          <div style={{ marginTop: 10, color: "#a6b7cd" }}>
            Badge: {latestEvent.badge_code || "-"} · Ora: {new Date(latestEvent.access_time).toLocaleString("it-IT")}
          </div>
        </div>
      )}

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Accessi recenti</h2>
          {loading ? <div style={emptyStyle}>Caricamento...</div> : events.length === 0 ? <div style={emptyStyle}>Nessun evento accesso.</div> : (
            <div style={listStyle}>
              {events.slice(0, 20).map((event) => (
                <EventRow key={event.id} event={event} getName={getName} />
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Accessi negati</h2>
          {loading ? <div style={emptyStyle}>Caricamento...</div> : deniedEvents.length === 0 ? <div style={emptyStyle}>Nessun accesso negato.</div> : (
            <div style={listStyle}>
              {deniedEvents.slice(0, 12).map((event) => (
                <EventRow key={event.id} event={event} getName={getName} />
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Presenti ora</h2>
          {loading ? <div style={emptyStyle}>Caricamento...</div> : presence.length === 0 ? <div style={emptyStyle}>Nessun cliente presente.</div> : (
            <div style={listStyle}>
              {presence.map((p) => {
                const enteredAt = new Date(p.entered_at);
                const minutes = Math.max(1, Math.floor((nowMs - enteredAt.getTime()) / 60000));
                return (
                  <div key={p.id} style={rowStyle}>
                    <div>
                      <div style={rowTitleStyle}>{getName(p.customers)}</div>
                      <div style={rowMetaStyle}>Badge: {p.badge_code || "sconosciuto"}</div>
                      <div style={rowMetaStyle}>Ultimo ingresso: {enteredAt.toLocaleTimeString("it-IT")}</div>
                    </div>
                    <div style={{ ...statusStyle, borderColor: "#22c55e", color: "#22c55e" }}>~ {minutes} min</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function EventRow({ event, getName }: { event: AccessEvent; getName: (x?: AccessEvent["customers"]) => string }) {
  const tone = event.was_allowed ? "consentito" : event.customer_id ? "negato" : "warning";
  const color = tone === "consentito" ? "#22c55e" : tone === "negato" ? "#ef4444" : "#f59e0b";

  return (
    <div style={rowStyle}>
      <div>
        <div style={rowTitleStyle}>{event.customer_id ? getName(event.customers) : "Badge sconosciuto"}</div>
        <div style={rowMetaStyle}>Codice badge: {event.badge_code || "-"}</div>
        <div style={rowMetaStyle}>Motivo: {event.reason || (event.was_allowed ? "Accesso consentito" : "N/D")}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ ...statusStyle, color, borderColor: color }}>{tone.toUpperCase()}</div>
        <div style={{ marginTop: 6, color: "#8ea0bb", fontSize: 12 }}>{new Date(event.access_time).toLocaleTimeString("it-IT")}</div>
      </div>
    </div>
  );
}

function InfoCard({ title, value, note }: { title: string; value: string; note: string }) {
  return <div style={statCardStyle}><div style={{ color: "#9eb1ca", fontSize: 13 }}>{title}</div><div style={{ marginTop: 8, fontSize: 34, fontWeight: 700 }}>{value}</div><div style={{ color: "#7f95b0", marginTop: 6, fontSize: 12 }}>{note}</div></div>;
}

const pageStyle: React.CSSProperties = { padding: 26, color: "#e7eef8", display: "grid", gap: 18 };
const heroStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(130deg, #0f172a, #111827)", border: "1px solid #1f2a3f", borderRadius: 22, padding: 20 };
const eyebrowStyle: React.CSSProperties = { color: "#8ea0bb", fontSize: 12, letterSpacing: "0.08em" };
const titleStyle: React.CSSProperties = { margin: "7px 0 0", fontSize: 30 };
const liveBadgeStyle: React.CSSProperties = { color: "#34d399", fontWeight: 700, fontSize: 14 };
const statsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const statCardStyle: React.CSSProperties = { background: "#0f172acc", border: "1px solid #24344f", borderRadius: 18, padding: 16 };
const latestPanelStyle: React.CSSProperties = { background: "#0f172acc", border: "1px solid #24344f", borderRadius: 18, padding: 18 };
const mainGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 };
const panelStyle: React.CSSProperties = { background: "#0a1220", border: "1px solid #233149", borderRadius: 18, padding: 16 };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const listStyle: React.CSSProperties = { display: "grid", gap: 10 };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, border: "1px solid #233149", borderRadius: 14, padding: 12, background: "#111827" };
const rowTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700 };
const rowMetaStyle: React.CSSProperties = { fontSize: 12, color: "#90a3bf", marginTop: 4 };
const statusStyle: React.CSSProperties = { border: "1px solid", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" };
const emptyStyle: React.CSSProperties = { color: "#90a3bf", fontSize: 13 };
