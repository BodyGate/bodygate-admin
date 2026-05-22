"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Program = any;
type Session = any;
type RecordItem = any;
type Customer = any;

export default function AthleteDashboardClient() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [program, setProgram] = useState<Program | null>(null);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, is_active")
      .eq("is_active", true)
      .order("last_name", { ascending: true });

    setCustomers(data || []);

    if (!customerId && data && data.length > 0) {
      setCustomerId(data[0].id);
    }
  }

  async function loadAthleteData(selectedCustomerId: string) {
    if (!selectedCustomerId) {
      setCustomer(null);
      setProgram(null);
      setTodaySession(null);
      setSessions([]);
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", selectedCustomerId)
      .maybeSingle();

    setCustomer(customerData || null);

    if (!customerData) {
      setProgram(null);
      setTodaySession(null);
      setSessions([]);
      setRecords([]);
      setLoading(false);
      return;
    }

    const { data: programData } = await supabase
      .from("training_programs")
      .select("*")
      .eq("customer_id", customerData.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setProgram(programData || null);

    const { data: sessionsData } = await supabase
      .from("workout_sessions")
      .select(`
        *,
        training_programs (title),
        training_program_days (title)
      `)
      .eq("customer_id", customerData.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setSessions(sessionsData || []);

    const activeSession =
      sessionsData?.find(
        (session) =>
          session.status === "in_progress" || session.status === "planned"
      ) || null;

    setTodaySession(activeSession);

    const { data: recordsData } = await supabase
      .from("customer_exercise_records")
      .select(`
        *,
        exercises_library (name)
      `)
      .eq("customer_id", customerData.id)
      .order("achieved_at", { ascending: false })
      .limit(8);

    setRecords(recordsData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadAthleteData(customerId);
    }
  }, [customerId]);

  async function startWorkout() {
    if (!customer) {
      alert("Cliente non trovato.");
      return;
    }

    if (todaySession) {
      router.push(`/training/workouts/${todaySession.id}`);
      return;
    }

    if (!program) {
      alert("Nessun programma attivo per questo cliente.");
      return;
    }

    setStarting(true);

    const { data: firstDay } = await supabase
      .from("training_program_days")
      .select("*")
      .eq("program_id", program.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstDay) {
      setStarting(false);
      alert("Questo programma non ha ancora giorni allenamento.");
      return;
    }

    const { data: newSession, error } = await supabase
      .from("workout_sessions")
      .insert({
        customer_id: customer.id,
        program_id: program.id,
        day_id: firstDay.id,
        status: "planned",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    setStarting(false);

    if (error || !newSession) {
      alert("Errore durante la creazione della sessione workout.");
      return;
    }

    router.push(`/training/workouts/${newSession.id}`);
  }

  const customerName =
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
    "Atleta";

  const weekSessions = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return sessions.filter((session) => {
      const date = new Date(session.created_at);
      return date >= sevenDaysAgo;
    });
  }, [sessions]);

  const completedWeek = weekSessions.filter(
    (session) => session.status === "completed"
  ).length;

  const streak = completedWeek;

  if (loading && customers.length === 0) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>Caricamento athlete dashboard...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>BodyGate Athlete</p>

        <h1 style={styles.title}>Ciao, {customerName}</h1>

        <p style={styles.subtitle}>
          Area workout personale: allenamenti, progressi, record e sessioni live.
        </p>

        <div style={styles.selectorBox}>
          <label style={styles.selectorLabel}>Cliente test</label>

          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={styles.select}
          >
            <option value="">Seleziona cliente</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {`${item.last_name || ""} ${item.first_name || ""}`.trim() ||
                  item.email ||
                  item.phone ||
                  "Cliente senza nome"}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={styles.todayCard}>
        <div>
          <p style={styles.cardLabel}>Workout di oggi</p>

          <h2 style={styles.todayTitle}>
            {todaySession?.training_program_days?.title ||
              program?.title ||
              "Pronto per allenarti"}
          </h2>

          <p style={styles.todaySubtitle}>
            {todaySession?.training_programs?.title ||
              program?.goal ||
              "Avvia una nuova sessione dal programma attivo"}
          </p>
        </div>

        <button
          onClick={startWorkout}
          disabled={starting || !customerId}
          style={{
            ...styles.startButton,
            opacity: starting || !customerId ? 0.6 : 1,
          }}
        >
          {starting
            ? "Creo sessione..."
            : todaySession
              ? "Continua Workout"
              : "Start Workout"}
        </button>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Workout settimana" value={`${completedWeek}`} />
        <StatCard label="Streak" value={`${streak}`} />
        <StatCard label="PR recenti" value={`${records.length}`} />
        <StatCard label="Programma" value={program ? "Attivo" : "N/D"} />
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Programma attivo</h2>
            <p style={styles.panelSubtitle}>Il piano attualmente assegnato.</p>
          </div>
        </div>

        {program ? (
          <div style={styles.programBox}>
            <div>
              <div style={styles.programTitle}>{program.title}</div>

              <div style={styles.programMeta}>
                {program.goal || "Obiettivo non definito"} ·{" "}
                {program.coach_name || "Coach"}
              </div>
            </div>

            <div style={styles.programDate}>
              {program.starts_at || "N/D"} → {program.ends_at || "N/D"}
            </div>
          </div>
        ) : (
          <div style={styles.empty}>
            Nessun programma attivo per questo cliente.
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Record recenti</h2>
            <p style={styles.panelSubtitle}>Ultimi PR registrati.</p>
          </div>
        </div>

        {records.length === 0 ? (
          <div style={styles.empty}>Nessun record registrato.</div>
        ) : (
          <div style={styles.recordsList}>
            {records.map((record) => (
              <div key={record.id} style={styles.recordCard}>
                <div>
                  <div style={styles.recordTitle}>
                    🏆 {record.exercises_library?.name || "Esercizio"}
                  </div>

                  <div style={styles.recordMeta}>{record.record_type}</div>
                </div>

                <div style={styles.recordValue}>
                  {Number(record.record_value).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Ultime sessioni</h2>
            <p style={styles.panelSubtitle}>Storico allenamenti recenti.</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div style={styles.empty}>Nessuna sessione registrata.</div>
        ) : (
          <div style={styles.sessionsList}>
            {sessions.slice(0, 6).map((session) => (
              <a
                key={session.id}
                href={`/training/workouts/${session.id}`}
                style={styles.sessionRow}
              >
                <div>
                  <div style={styles.sessionTitle}>
                    {session.training_program_days?.title || "Workout"}
                  </div>

                  <div style={styles.sessionMeta}>
                    {session.training_programs?.title || "Programma"} ·{" "}
                    {new Date(session.created_at).toLocaleDateString("it-IT")}
                  </div>
                </div>

                <span
                  style={{
                    ...styles.statusBadge,
                    background:
                      session.status === "completed"
                        ? "rgba(34,197,94,0.16)"
                        : "rgba(37,99,235,0.16)",
                    color:
                      session.status === "completed" ? "#86efac" : "#bfdbfe",
                  }}
                >
                  {session.status}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 920,
    margin: "0 auto",
    color: "#fff",
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#94a3b8",
  },
  hero: {
    padding: 28,
    borderRadius: 30,
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.30), rgba(15,23,42,0.98) 45%, rgba(2,6,23,1))",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  eyebrow: {
    margin: 0,
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  title: {
    margin: "10px 0 0",
    fontSize: 36,
    fontWeight: 900,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 8,
    lineHeight: 1.5,
  },
  selectorBox: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  selectorLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  select: {
    width: "100%",
    background: "#020617",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: "14px 16px",
    outline: "none",
    fontWeight: 800,
  },
  todayCard: {
    padding: 22,
    borderRadius: 26,
    marginBottom: 16,
    background: "rgba(15,23,42,0.94)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardLabel: {
    color: "#60a5fa",
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  todayTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: "8px 0 0",
  },
  todaySubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },
  startButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "15px 18px",
    borderRadius: 16,
    fontWeight: 900,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    padding: 18,
    borderRadius: 22,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 900,
    marginTop: 8,
  },
  panel: {
    padding: 20,
    borderRadius: 26,
    background: "rgba(15,23,42,0.94)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  panelHeader: {
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },
  panelSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },
  programBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  programTitle: {
    fontSize: 18,
    fontWeight: 900,
  },
  programMeta: {
    color: "#94a3b8",
    marginTop: 5,
    fontSize: 13,
  },
  programDate: {
    color: "#bfdbfe",
    fontWeight: 800,
    fontSize: 13,
  },
  recordsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  recordCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#020617",
    border: "1px solid rgba(34,197,94,0.18)",
  },
  recordTitle: {
    fontWeight: 900,
  },
  recordMeta: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  recordValue: {
    color: "#86efac",
    fontSize: 22,
    fontWeight: 900,
  },
  sessionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sessionRow: {
    textDecoration: "none",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  sessionTitle: {
    fontWeight: 900,
  },
  sessionMeta: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  empty: {
    padding: 20,
    borderRadius: 18,
    background: "#020617",
    border: "1px dashed rgba(255,255,255,0.08)",
    color: "#94a3b8",
    textAlign: "center",
  },
};