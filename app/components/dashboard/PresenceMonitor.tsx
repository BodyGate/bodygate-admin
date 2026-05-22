"use client";

type Presence = {
  id: string;
  entered_at: string;
  badge_code: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type Props = {
  loading: boolean;
  peopleInside: Presence[];
};

export default function PresenceMonitor({
  loading,
  peopleInside,
}: Props) {
  function getDuration(date: string) {
    const entered = new Date(date).getTime();
    const now = Date.now();

    const diff = Math.floor((now - entered) / 1000 / 60);

    if (diff < 60) {
      return `${diff} min`;
    }

    const hours = Math.floor(diff / 60);
    const mins = diff % 60;

    return `${hours}h ${mins}m`;
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Persone presenti ora</h2>

          <p style={subtitleStyle}>
            Monitor realtime accessi palestra.
          </p>
        </div>

        <div style={counterStyle}>
          {peopleInside.length}
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>
          Caricamento presenze...
        </div>
      ) : peopleInside.length === 0 ? (
        <div style={emptyStyle}>
          Nessuna presenza attiva.
        </div>
      ) : (
        <div style={listStyle}>
          {peopleInside.map((person) => {
            const name =
              `${person.customers?.first_name || ""} ${person.customers?.last_name || ""}`.trim() ||
              "Cliente";

            return (
              <div key={person.id} style={rowStyle}>
                <div>
                  <strong>{name}</strong>

                  <div style={mutedStyle}>
                    Badge: {person.badge_code || "-"}
                  </div>

                  <div style={mutedStyle}>
                    Entrato alle{" "}
                    {new Date(person.entered_at).toLocaleTimeString("it-IT")}
                  </div>
                </div>

                <div style={timeStyle}>
                  {getDuration(person.entered_at)}
                </div>
              </div>
            );
          })}
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
  alignItems: "center",
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

const counterStyle: React.CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "rgba(239,68,68,0.15)",
  color: "#ef4444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "20px",
  border: "1px solid rgba(239,68,68,0.30)",
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
  color: "var(--muted)",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px",
  borderRadius: "18px",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "12px",
  marginTop: "4px",
};

const timeStyle: React.CSSProperties = {
  color: "var(--success)",
  fontWeight: 900,
  fontSize: "14px",
};