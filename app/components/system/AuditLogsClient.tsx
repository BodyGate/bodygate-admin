"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AuditLog = {
  id: string;
  staff_email: string;
  staff_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  details: any;
};

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);

    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    setLogs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();

    const channel = supabase
      .channel("audit-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        loadLogs
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>
            BodyGate Security
          </p>

          <h1 style={styles.title}>
            Audit Logs
          </h1>

          <p style={styles.subtitle}>
            Storico attività amministrative e
            operazioni sensibili della piattaforma.
          </p>
        </div>
      </section>

      {loading ? (
        <div style={styles.loading}>
          Caricamento logs...
        </div>
      ) : (
        <section style={styles.logs}>
          {logs.map((log) => (
            <article
              key={log.id}
              style={styles.card}
            >
              <div style={styles.top}>
                <div>
                  <div style={styles.action}>
                    {log.action}
                  </div>

                  <div style={styles.staff}>
                    {log.staff_name}
                  </div>
                </div>

                <div style={styles.date}>
                  {new Date(
                    log.created_at
                  ).toLocaleString("it-IT")}
                </div>
              </div>

              <div style={styles.meta}>
                <span>
                  Entity:{" "}
                  {log.entity_type || "-"}
                </span>

                <span>
                  ID: {log.entity_id || "-"}
                </span>
              </div>

              {log.details && (
                <pre style={styles.details}>
                  {JSON.stringify(
                    log.details,
                    null,
                    2
                  )}
                </pre>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "#fff",
  },

  hero: {
    padding: 28,
    borderRadius: 28,
    marginBottom: 24,

    background:
      "linear-gradient(135deg, rgba(14,165,233,0.20), rgba(15,23,42,0.96) 45%, rgba(2,6,23,1))",

    border: "1px solid rgba(255,255,255,0.08)",
  },

  eyebrow: {
    color: "#38bdf8",
    textTransform: "uppercase",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },

  title: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
  },

  subtitle: {
    color: "#94a3b8",
    maxWidth: 700,
  },

  loading: {
    color: "#94a3b8",
  },

  logs: {
    display: "grid",
    gap: 18,
  },

  card: {
    padding: 24,
    borderRadius: 24,

    background: "rgba(15,23,42,0.92)",

    border: "1px solid rgba(255,255,255,0.08)",
  },

  top: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 16,
  },

  action: {
    fontSize: 18,
    fontWeight: 800,
  },

  staff: {
    color: "#94a3b8",
    marginTop: 4,
  },

  date: {
    color: "#64748b",
    fontSize: 13,
  },

  meta: {
    display: "flex",
    gap: 20,
    marginBottom: 16,
    color: "#94a3b8",
    fontSize: 13,
  },

  details: {
    background: "#020617",
    borderRadius: 16,
    padding: 16,
    overflowX: "auto",
    color: "#cbd5e1",
    fontSize: 12,
  },
};