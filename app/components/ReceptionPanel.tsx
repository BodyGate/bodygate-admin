"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ReceptionAccessCard from "./ReceptionAccessCard";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  subscription_status: string | null;
  active: boolean;
};

type AccessEvent = {
  id: string;
  created_at: string;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  allowed: boolean;
  reason: string | null;
  customer?: Customer | null;
};

export default function ReceptionPanel() {
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [systemTime, setSystemTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [popupEvent, setPopupEvent] = useState<AccessEvent | null>(null);

  async function enrichEvent(event: AccessEvent): Promise<AccessEvent> {
    if (!event.customer_id) return event;

    const { data } = await supabase
      .from("customers")
      .select("id, full_name, phone, subscription_status, active")
      .eq("id", event.customer_id)
      .single();

    return {
      ...event,
      customer: data as Customer,
    };
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      const enriched = await Promise.all(
        (data as AccessEvent[]).map((event) => enrichEvent(event))
      );

      setEvents(enriched);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadEvents();

    const channel = supabase
      .channel("reception_access_logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "access_logs",
        },
        async (payload) => {
          const newEvent = await enrichEvent(payload.new as AccessEvent);

          setEvents((current) => [newEvent, ...current.slice(0, 19)]);
          setPopupEvent(newEvent);

          setTimeout(() => {
            setPopupEvent(null);
          }, 4500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString("it-IT"));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return events;

    return events.filter((event) => {
      return (
        event.badge_code?.toLowerCase().includes(value) ||
        event.controller_code?.toLowerCase().includes(value) ||
        event.reason?.toLowerCase().includes(value) ||
        event.customer_id?.toLowerCase().includes(value) ||
        event.customer?.full_name?.toLowerCase().includes(value) ||
        event.customer?.phone?.toLowerCase().includes(value)
      );
    });
  }, [events, search]);

  const lastEvent = events[0];

  async function openTurnstile() {
    try {
      await fetch("/api/turnstile/open", {
        method: "POST",
      });
    } catch {
      console.log("Errore apertura tornello");
    }
  }

  return (
    <div style={{ display: "grid", gap: "22px", position: "relative" }}>
      {popupEvent && (
        <div
          style={{
            position: "fixed",
            top: "32px",
            right: "32px",
            zIndex: 9999,
            width: "460px",
            maxWidth: "calc(100vw - 40px)",
            background: popupEvent.allowed
              ? "rgba(34,197,94,0.16)"
              : "rgba(239,68,68,0.16)",
            border: popupEvent.allowed
              ? "1px solid rgba(34,197,94,0.45)"
              : "1px solid rgba(239,68,68,0.45)",
            boxShadow: popupEvent.allowed
              ? "0 0 40px rgba(34,197,94,0.25)"
              : "0 0 40px rgba(239,68,68,0.25)",
            backdropFilter: "blur(18px)",
            borderRadius: "28px",
            padding: "26px",
            color: "var(--text)",
          }}
        >
          <div
            style={{
              color: popupEvent.allowed ? "#22c55e" : "#ef4444",
              fontSize: "14px",
              fontWeight: "bold",
              letterSpacing: "0.08em",
            }}
          >
            {popupEvent.allowed ? "ACCESSO CONSENTITO" : "ACCESSO NEGATO"}
          </div>

          <div
            style={{
              marginTop: "12px",
              fontSize: "34px",
              fontWeight: "bold",
              lineHeight: 1.1,
            }}
          >
            {popupEvent.customer?.full_name || "Cliente non identificato"}
          </div>

          <div
            style={{
              marginTop: "10px",
              color: "var(--muted)",
              fontSize: "15px",
            }}
          >
            Badge {popupEvent.badge_code || "-"}
            {popupEvent.customer?.phone ? ` · ${popupEvent.customer.phone}` : ""}
          </div>

          <div
            style={{
              marginTop: "12px",
              color: "var(--muted)",
              fontSize: "15px",
            }}
          >
            {popupEvent.reason || "Evento accesso ricevuto"}
          </div>

          <div
            style={{
              marginTop: "14px",
              fontSize: "13px",
              color: "var(--muted)",
            }}
          >
            {new Date(popupEvent.created_at).toLocaleString("it-IT")}
          </div>
        </div>
      )}

      <div style={headerCard}>
        <div style={headerRow}>
          <div>
            <div style={eyebrow}>RECEPTION MODE</div>

            <h1 style={title}>Live Access Desk</h1>

            <div style={subtitle}>
              Monitoraggio accessi realtime BodyGate con identificazione cliente.
            </div>
          </div>

          <div style={liveBadge}>● LIVE {systemTime}</div>
        </div>

        <div style={actionGrid}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ricerca cliente, badge, telefono..."
            style={inputStyle}
          />

          <button onClick={openTurnstile} style={primaryButton}>
            Apri tornello
          </button>

          <button onClick={loadEvents} style={secondaryButton}>
            Refresh
          </button>
        </div>
      </div>

      {lastEvent && (
        <div
          style={{
            background: lastEvent.allowed
              ? "rgba(34,197,94,0.12)"
              : "rgba(239,68,68,0.12)",
            border: lastEvent.allowed
              ? "1px solid rgba(34,197,94,0.35)"
              : "1px solid rgba(239,68,68,0.35)",
            borderRadius: "28px",
            padding: "30px",
          }}
        >
          <div
            style={{
              color: lastEvent.allowed ? "#22c55e" : "#ef4444",
              fontSize: "15px",
              fontWeight: "bold",
              letterSpacing: "0.08em",
            }}
          >
            ULTIMO EVENTO
          </div>

          <div style={{ marginTop: "12px", fontSize: "42px", fontWeight: "bold" }}>
            {lastEvent.customer?.full_name || "Cliente non identificato"}
          </div>

          <div style={{ marginTop: "12px", color: "var(--muted)", fontSize: "17px" }}>
            {lastEvent.allowed ? "Accesso consentito" : "Accesso negato"} · Badge{" "}
            {lastEvent.badge_code || "-"} ·{" "}
            {new Date(lastEvent.created_at).toLocaleString("it-IT")}
          </div>
        </div>
      )}

      <div style={contentGrid}>
        <div style={panelCard}>
          <div style={sectionTitle}>Ultimi accessi reali</div>

          {loading ? (
            <div style={{ color: "var(--muted)" }}>Caricamento accessi...</div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>Nessun accesso trovato.</div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {filteredEvents.map((event) => (
                <ReceptionAccessCard
                  key={event.id}
                  name={event.customer?.full_name || event.reason || "Cliente non identificato"}
                  badge={event.badge_code || "-"}
                  allowed={event.allowed}
                  time={new Date(event.created_at).toLocaleTimeString("it-IT")}
                />
              ))}
            </div>
          )}
        </div>

        <div style={panelCard}>
          <div style={sectionTitle}>Stato sistema</div>

          <div style={{ display: "grid", gap: "14px" }}>
            <SystemMiniCard label="Bridge" value="READY" color="#22c55e" />
            <SystemMiniCard label="Controller" value="CONNECTED" color="#22c55e" />
            <SystemMiniCard label="Realtime" value="ACTIVE" color="#22c55e" />
            <SystemMiniCard
              label="Ultimo badge"
              value={lastEvent?.badge_code || "-"}
              color="#3b82f6"
            />
            <SystemMiniCard
              label="Ultimo cliente"
              value={lastEvent?.customer?.full_name || "-"}
              color="var(--text)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemMiniCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={miniCard}>
      <div style={{ color: "var(--muted)", fontSize: "13px" }}>
        {label.toUpperCase()}
      </div>

      <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: "bold", color }}>
        {value}
      </div>
    </div>
  );
}

const headerCard: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "30px",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  flexWrap: "wrap",
  alignItems: "center",
};

const eyebrow: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.08em",
};

const title: React.CSSProperties = {
  margin: "10px 0 0 0",
  fontSize: "52px",
  lineHeight: 1,
};

const subtitle: React.CSSProperties = {
  marginTop: "12px",
  color: "var(--muted)",
  fontSize: "18px",
};

const liveBadge: React.CSSProperties = {
  background: "rgba(34,197,94,0.10)",
  border: "1px solid rgba(34,197,94,0.25)",
  color: "#22c55e",
  borderRadius: "999px",
  padding: "14px 18px",
  fontWeight: "bold",
  fontSize: "15px",
};

const actionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr",
  gap: "18px",
  marginTop: "28px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "18px",
  color: "var(--text)",
  fontSize: "16px",
  outline: "none",
};

const contentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr",
  gap: "22px",
};

const panelCard: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "24px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  marginBottom: "20px",
};

const miniCard: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "18px",
};

const primaryButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "16px",
  padding: "18px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "15px",
};

const secondaryButton: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "18px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "15px",
};