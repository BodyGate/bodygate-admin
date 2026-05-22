"use client";

type AccessLog = {
  id: string;
  access_time: string;
  badge_code: string | null;
  controller_code: string | null;
  was_allowed: boolean;
  reason: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type Props = {
  loading: boolean;
  accessLogs: AccessLog[];
};

export default function LiveActivityFeed({ loading, accessLogs }: Props) {
  function getCustomerName(log: AccessLog) {
    const firstName = log.customers?.first_name || "";
    const lastName = log.customers?.last_name || "";

    return `${firstName} ${lastName}`.trim() || "Badge non associato";
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Live Activity Feed</h2>
          <p style={subtitleStyle}>Eventi tornello in tempo reale.</p>
        </div>

        <div style={liveBadgeStyle}>
          <span style={liveDotStyle} />
          LIVE
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>Caricamento feed live...</div>
      ) : accessLogs.length === 0 ? (
        <div style={emptyStyle}>Nessun evento live registrato oggi.</div>
      ) : (
        <div style={feedStyle}>
          {accessLogs.slice(0, 6).map((log) => (
            <div
              key={log.id}
              style={log.was_allowed ? eventOkStyle : eventNoStyle}
            >
              <div style={statusIconStyle}>
                {log.was_allowed ? "✓" : "!"}
              </div>

              <div style={{ flex: 1 }}>
                <div style={eventTitleStyle}>
                  {log.was_allowed ? "Accesso consentito" : "Accesso negato"}
                </div>

                <div style={eventNameStyle}>{getCustomerName(log)}</div>

                <div style={eventMetaStyle}>
                  Badge {log.badge_code || "-"} ·{" "}
                  {new Date(log.access_time).toLocaleTimeString("it-IT")}
                </div>

                {log.reason && (
                  <div style={eventReasonStyle}>{log.reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
};

const titleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "22px",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  marginTop: "8px",
  fontSize: "14px",
};

const liveBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "999px",
  padding: "8px 12px",
  background: "rgba(34,197,94,0.10)",
  border: "1px solid rgba(34,197,94,0.25)",
  color: "var(--success)",
  fontSize: "12px",
  fontWeight: 900,
};

const liveDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--success)",
  boxShadow: "0 0 14px var(--success)",
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
  color: "var(--muted)",
};

const feedStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const baseEventStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  padding: "14px",
  borderRadius: "18px",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const eventOkStyle: React.CSSProperties = {
  ...baseEventStyle,
  borderColor: "rgba(34,197,94,0.30)",
};

const eventNoStyle: React.CSSProperties = {
  ...baseEventStyle,
  borderColor: "rgba(239,68,68,0.35)",
};

const statusIconStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "rgba(239,68,68,0.16)",
  color: "#ef4444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const eventTitleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontWeight: 900,
};

const eventNameStyle: React.CSSProperties = {
  color: "var(--text)",
  marginTop: "4px",
};

const eventMetaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "12px",
  marginTop: "4px",
};

const eventReasonStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "12px",
  marginTop: "6px",
};