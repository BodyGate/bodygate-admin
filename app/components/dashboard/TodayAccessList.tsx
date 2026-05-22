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

export default function TodayAccessList({
  loading,
  accessLogs,
}: Props) {
  function getCustomerName(log: AccessLog) {
    const firstName =
      log.customers?.first_name || "";

    const lastName =
      log.customers?.last_name || "";

    return (
      `${firstName} ${lastName}`.trim() ||
      "Badge non associato"
    );
  }

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>
        Ultimi accessi di oggi
      </h2>

      <p style={sectionTextStyle}>
        Aggiornamento automatico ogni 3 secondi.
      </p>

      {loading ? (
        <div style={emptyStyle}>
          Caricamento accessi...
        </div>
      ) : accessLogs.length === 0 ? (
        <div style={emptyStyle}>
          Nessun accesso registrato oggi.
        </div>
      ) : (
        <div style={logsListStyle}>
          {accessLogs.slice(0, 8).map((log) => (
            <div key={log.id} style={logRowStyle}>
              <div>
                <strong>
                  {log.was_allowed
                    ? "Accesso consentito"
                    : "Accesso negato"}
                </strong>

                <div style={mutedSmallStyle}>
                  {getCustomerName(log)}
                </div>

                <div style={mutedSmallStyle}>
                  Badge: {log.badge_code || "-"} ·
                  Controller:{" "}
                  {log.controller_code || "-"}
                </div>

                <div style={mutedSmallStyle}>
                  {log.reason || "-"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={logStatusStyle(
                    log.was_allowed
                  )}
                >
                  {log.was_allowed ? "OK" : "NO"}
                </div>

                <div style={mutedSmallStyle}>
                  {new Date(
                    log.access_time
                  ).toLocaleTimeString("it-IT")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "22px",
  margin: "0 0 10px",
  letterSpacing: "-0.5px",
};

const sectionTextStyle: React.CSSProperties = {
  color: "var(--muted)",
  margin: "0 0 22px",
  lineHeight: 1.6,
};

const emptyStyle: React.CSSProperties = {
  color: "var(--muted)",
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
  marginBottom: "18px",
};

const logsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: "18px",
};

const logRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  padding: "14px",
  borderRadius: "18px",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const mutedSmallStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "12px",
  marginTop: "5px",
};

const logStatusStyle = (
  allowed: boolean
): React.CSSProperties => ({
  display: "inline-block",
  color: allowed
    ? "var(--success)"
    : "var(--danger)",
  fontWeight: 900,
  fontSize: "13px",
});