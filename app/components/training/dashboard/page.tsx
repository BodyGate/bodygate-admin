export default function TrainingDashboardPage() {
  return (
    <main
      style={{
        padding: 28,
        color: "#fff",
      }}
    >
      <section
        style={{
          padding: 32,
          borderRadius: 30,
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.98) 45%, rgba(2,6,23,1))",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                color: "#60a5fa",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 10,
              }}
            >
              BodyGate Training
            </p>

            <h1
              style={{
                fontSize: 42,
                fontWeight: 900,
                margin: 0,
              }}
            >
              Training Dashboard
            </h1>

            <p
              style={{
                color: "#94a3b8",
                marginTop: 12,
                maxWidth: 700,
                lineHeight: 1.6,
              }}
            >
              Gestione workout, clienti, progressi e check-in in un ecosistema
              training professionale.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button style={styles.primaryButton}>
              Nuovo Programma
            </button>

            <button style={styles.secondaryButton}>
              Nuovo Check-in
            </button>
          </div>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          title="Clienti attivi"
          value="24"
          subtitle="+3 questa settimana"
        />

        <StatCard
          title="Workout oggi"
          value="18"
          subtitle="11 completati"
        />

        <StatCard
          title="Check-in pending"
          value="7"
          subtitle="Da revisionare"
        />

        <StatCard
          title="Aderenza media"
          value="87%"
          subtitle="Ultimi 30 giorni"
        />
      </section>

      <section style={styles.mainGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Clienti recenti</h2>

              <p style={styles.panelSubtitle}>
                Ultimi clienti attivi nella piattaforma training.
              </p>
            </div>
          </div>

          <div style={styles.list}>
            <ClientRow
              name="Marco Rossi"
              workout="Push A"
              status="Allenamento completato"
            />

            <ClientRow
              name="Luca Bianchi"
              workout="Upper Strength"
              status="Workout in corso"
            />

            <ClientRow
              name="Giuseppe Verdi"
              workout="Leg Day"
              status="Nessun accesso oggi"
            />
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Alerts intelligenti</h2>

              <p style={styles.panelSubtitle}>
                Monitoraggio clienti e performance.
              </p>
            </div>
          </div>

          <div style={styles.alertList}>
            <AlertCard
              title="Cliente fermo da 8 giorni"
              description="Marco Rossi non accede alla palestra da oltre una settimana."
            />

            <AlertCard
              title="Aderenza bassa"
              description="Luca Bianchi ha completato solo il 52% dei workout."
            />

            <AlertCard
              title="Nuovo PR registrato"
              description="Giuseppe Verdi ha migliorato il massimale squat."
            />
          </div>
        </div>
      </section>

      <section style={styles.bottomGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Quick Actions</h2>

              <p style={styles.panelSubtitle}>
                Accesso rapido alle funzioni principali.
              </p>
            </div>
          </div>

          <div style={styles.quickGrid}>
            <QuickButton label="Crea programma" />
            <QuickButton label="Assegna cliente" />
            <QuickButton label="Apri libreria" />
            <QuickButton label="Nuovo check-in" />
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Workout Activity</h2>

              <p style={styles.panelSubtitle}>
                Attività allenamenti ultime 24h.
              </p>
            </div>
          </div>

          <div style={styles.activityFeed}>
            <ActivityRow
              text="Marco Rossi ha completato Push A"
              time="14 min fa"
            />

            <ActivityRow
              text="Luca Bianchi ha aggiornato il check-in"
              time="32 min fa"
            />

            <ActivityRow
              text="Nuovo programma creato"
              time="1h fa"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>

      <div style={styles.statValue}>{value}</div>

      <div style={styles.statSubtitle}>{subtitle}</div>
    </div>
  );
}

function ClientRow({
  name,
  workout,
  status,
}: {
  name: string;
  workout: string;
  status: string;
}) {
  return (
    <div style={styles.clientRow}>
      <div>
        <div style={styles.clientName}>{name}</div>

        <div style={styles.clientWorkout}>{workout}</div>
      </div>

      <div style={styles.clientStatus}>{status}</div>
    </div>
  );
}

function AlertCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={styles.alertCard}>
      <div style={styles.alertTitle}>{title}</div>

      <div style={styles.alertDescription}>{description}</div>
    </div>
  );
}

function QuickButton({ label }: { label: string }) {
  return (
    <button style={styles.quickButton}>
      {label}
    </button>
  );
}

function ActivityRow({
  text,
  time,
}: {
  text: string;
  time: string;
}) {
  return (
    <div style={styles.activityRow}>
      <div style={styles.activityText}>{text}</div>

      <div style={styles.activityTime}>{time}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
    marginBottom: 24,
  },

  statCard: {
    padding: 24,
    borderRadius: 24,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  statTitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 10,
  },

  statValue: {
    fontSize: 36,
    fontWeight: 900,
  },

  statSubtitle: {
    color: "#64748b",
    marginTop: 10,
    fontSize: 13,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 24,
    marginBottom: 24,
  },

  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },

  panel: {
    padding: 24,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  panelHeader: {
    marginBottom: 22,
  },

  panelTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
  },

  panelSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  clientRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  clientName: {
    fontWeight: 800,
    marginBottom: 5,
  },

  clientWorkout: {
    color: "#94a3b8",
    fontSize: 13,
  },

  clientStatus: {
    color: "#60a5fa",
    fontWeight: 700,
    fontSize: 13,
  },

  alertList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  alertCard: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.18)",
  },

  alertTitle: {
    fontWeight: 800,
    marginBottom: 8,
  },

  alertDescription: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 1.5,
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 14,
  },

  quickButton: {
    padding: 20,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#020617",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  activityFeed: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  activityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  activityText: {
    fontWeight: 700,
  },

  activityTime: {
    color: "#94a3b8",
    fontSize: 13,
  },
};