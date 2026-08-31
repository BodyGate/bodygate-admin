"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BGButton,
  BGCard,
  BGEmptyState,
  BGInput,
  BGPageHeader,
  BGPageShell,
  BGSelect,
  BGStatusBadge,
} from "@/components/bodygate-ui";
import { safeRandomId } from "../../lib/safeRandomId";
import CoursesNav from "./CoursesNav";

type Branch = { id: string; name: string; city?: string | null };

type CourseSession = {
  id: string;
  starts_at: string;
  status: string;
  course_types?: { id: string; name: string; color: string; default_price: number | null } | null;
};

type CourseBooking = {
  id: string;
  status: string;
  booking_source: string;
  payment_id: string | null;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

type CourseSchedule = {
  id: string;
  weekday: number;
  start_time: string;
  status: string;
  course_types?: { id: string; name: string; color: string } | null;
};

type CourseEnrollment = {
  id: string;
  status: string;
  pricing_mode: string;
  fixed_price: number | null;
  billing_cycle: string;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

const WEEKDAYS = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

async function postJson(url: string, body: Record<string, unknown>) {
  const idempotencyKey = safeRandomId("courses-payments");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok && result?.ok, result };
}

function customerFullName(customer?: { first_name: string; last_name: string } | null) {
  if (!customer) return "Cliente";
  return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente";
}

function currentMonthLabel() {
  return new Date().toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export default function CoursesPaymentsClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [activeTab, setActiveTab] = useState<"sessions" | "enrollments">("sessions");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [message, setMessage] = useState("");

  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [bookings, setBookings] = useState<CourseBooking[]>([]);
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});
  const [busyBookingId, setBusyBookingId] = useState("");

  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [renewAmounts, setRenewAmounts] = useState<Record<string, string>>({});
  const [renewMethods, setRenewMethods] = useState<Record<string, string>>({});
  const [renewLabels, setRenewLabels] = useState<Record<string, string>>({});
  const [busyEnrollmentId, setBusyEnrollmentId] = useState("");

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      loadSessions(branchId);
      loadSchedules(branchId);
    }
  }, [branchId]);

  useEffect(() => {
    if (sessionId) loadBookings(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (scheduleId) loadEnrollments(scheduleId);
  }, [scheduleId]);

  async function loadBranches() {
    const response = await fetch("/api/settings/branches", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list = result?.ok ? (result.branches as Branch[]) : [];
    setBranches(list);
    if (list.length > 0) setBranchId(list[0].id);
    setLoadingBranches(false);
  }

  async function loadSessions(currentBranchId: string) {
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const to = new Date().toISOString();
    const params = new URLSearchParams({ branch_id: currentBranchId, from, to });
    const response = await fetch(`/api/courses/sessions?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list: CourseSession[] = result?.ok ? result.course_sessions : [];
    setSessions(list.filter((session) => session.status === "scheduled" || session.status === "completed"));
  }

  async function loadSchedules(currentBranchId: string) {
    const response = await fetch(`/api/courses/schedules?branch_id=${encodeURIComponent(currentBranchId)}`, {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    const list: CourseSchedule[] = result?.ok ? result.course_schedules : [];
    setSchedules(list.filter((schedule) => schedule.status === "active"));
  }

  async function loadBookings(currentSessionId: string) {
    const response = await fetch(`/api/courses/bookings?session_id=${encodeURIComponent(currentSessionId)}`, {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    const list: CourseBooking[] = result?.ok ? result.course_bookings : [];
    setBookings(list);

    const session = sessions.find((s) => s.id === currentSessionId);
    const defaultPrice = session?.course_types?.default_price;
    setPayAmounts((prev) => {
      const next = { ...prev };
      for (const item of list) {
        if (!(item.id in next) && defaultPrice != null) next[item.id] = String(defaultPrice);
      }
      return next;
    });
  }

  async function loadEnrollments(currentScheduleId: string) {
    const response = await fetch(`/api/courses/enrollments?schedule_id=${encodeURIComponent(currentScheduleId)}`, {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    const list: CourseEnrollment[] = result?.ok ? result.course_enrollments : [];
    setEnrollments(list.filter((item) => item.status === "active" && item.pricing_mode === "fixed"));

    setRenewAmounts((prev) => {
      const next = { ...prev };
      for (const item of list) {
        if (!(item.id in next) && item.fixed_price != null) next[item.id] = String(item.fixed_price);
      }
      return next;
    });
    setRenewLabels((prev) => {
      const next = { ...prev };
      for (const item of list) {
        if (!(item.id in next)) next[item.id] = currentMonthLabel();
      }
      return next;
    });
  }

  const payableBookings = useMemo(
    () => bookings.filter((b) => (b.status === "confirmed" || b.status === "attended") && !b.payment_id),
    [bookings],
  );
  const paidBookings = useMemo(() => bookings.filter((b) => b.payment_id), [bookings]);

  async function payBooking(bookingId: string) {
    const amount = Number(payAmounts[bookingId]);
    const method = payMethods[bookingId] || "cash";

    if (!amount || amount <= 0) {
      setMessage("Inserisci un importo valido.");
      return;
    }

    setBusyBookingId(bookingId);
    setMessage("");

    const { ok, result } = await postJson(`/api/courses/bookings/${bookingId}/pay`, {
      amount,
      payment_method: method,
    });

    setBusyBookingId("");

    if (!ok) {
      setMessage(result?.error || "Errore incasso.");
      return;
    }

    setMessage("Pagamento registrato.");
    await loadBookings(sessionId);
  }

  async function renewEnrollment(enrollmentId: string) {
    const amount = Number(renewAmounts[enrollmentId]);
    const method = renewMethods[enrollmentId] || "cash";
    const label = (renewLabels[enrollmentId] || "").trim();

    if (!amount || amount <= 0) {
      setMessage("Inserisci un importo valido.");
      return;
    }
    if (!label) {
      setMessage("Inserisci il periodo di riferimento (es. Ottobre 2026).");
      return;
    }

    setBusyEnrollmentId(enrollmentId);
    setMessage("");

    const { ok, result } = await postJson(`/api/courses/enrollments/${enrollmentId}/renew-payment`, {
      amount,
      payment_method: method,
      period_label: label,
    });

    setBusyEnrollmentId("");

    if (!ok) {
      setMessage(result?.error || "Errore rinnovo pagamento.");
      return;
    }

    setMessage("Rinnovo registrato.");
  }

  return (
    <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate · Corsi"
        title="Pagamenti corsi"
        subtitle="Incasso prenotazioni a lezione e rinnovo periodico delle iscrizioni a prezzo fisso."
        actions={
          branches.length > 0 ? (
            <BGSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.city ? ` - ${branch.city}` : ""}
                </option>
              ))}
            </BGSelect>
          ) : null
        }
      />

      <CoursesNav />

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <BGButton variant={activeTab === "sessions" ? "primary" : "secondary"} onClick={() => setActiveTab("sessions")}>
          Pagamenti a lezione
        </BGButton>
        <BGButton variant={activeTab === "enrollments" ? "primary" : "secondary"} onClick={() => setActiveTab("enrollments")}>
          Rinnovi iscrizioni fisse
        </BGButton>
      </div>

      {message && (
        <BGCard variant="soft" style={{ marginBottom: 18 }}>
          {message}
        </BGCard>
      )}

      {loadingBranches ? (
        <BGCard>
          <BGEmptyState title="Caricamento..." description="Recupero sedi in corso." />
        </BGCard>
      ) : !branchId ? (
        <BGCard>
          <BGEmptyState title="Nessuna sede attiva" description="Configura almeno una sede prima di gestire i corsi." />
        </BGCard>
      ) : activeTab === "sessions" ? (
        <div style={{ display: "grid", gap: 16 }}>
          <BGCard variant="soft">
            <label>
              Sessione (ultimi 7 giorni)
              <BGSelect value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">Seleziona...</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.starts_at).toLocaleString("it-IT", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {session.course_types?.name || "Corso"}
                  </option>
                ))}
              </BGSelect>
            </label>
          </BGCard>

          {!sessionId ? (
            <BGCard>
              <BGEmptyState title="Seleziona una sessione" description="Scegli una sessione per vedere le prenotazioni da incassare." />
            </BGCard>
          ) : (
            <BGCard>
              <h2 style={{ marginTop: 0 }}>Da incassare</h2>
              {payableBookings.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Nessuna prenotazione da incassare per questa sessione.</p>
              ) : (
                <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                  {payableBookings.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--bg-soft)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{customerFullName(item.customers)}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {item.booking_source === "system" ? "Generata da iscrizione fissa" : "Prenotazione diretta"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <BGInput
                          type="number"
                          step="0.01"
                          style={{ width: 100 }}
                          value={payAmounts[item.id] ?? ""}
                          onChange={(e) => setPayAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="€"
                        />
                        <BGSelect
                          value={payMethods[item.id] ?? "cash"}
                          onChange={(e) => setPayMethods((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        >
                          <option value="cash">Contanti</option>
                          <option value="pos">POS</option>
                          <option value="bank_transfer">Bonifico</option>
                        </BGSelect>
                        <BGButton onClick={() => payBooking(item.id)} disabled={busyBookingId === item.id}>
                          {busyBookingId === item.id ? "Incasso..." : "Incassa"}
                        </BGButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h2>Già incassate</h2>
              {paidBookings.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Nessun incasso registrato per questa sessione.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {paidBookings.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span>{customerFullName(item.customers)}</span>
                      <BGStatusBadge tone="success">Pagato</BGStatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </BGCard>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <BGCard variant="soft">
            <label>
              Orario ricorrente
              <BGSelect value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
                <option value="">Seleziona...</option>
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.course_types?.name || "Corso"} · {WEEKDAYS[schedule.weekday]} {schedule.start_time.slice(0, 5)}
                  </option>
                ))}
              </BGSelect>
            </label>
          </BGCard>

          {!scheduleId ? (
            <BGCard>
              <BGEmptyState title="Seleziona un orario" description="Scegli un orario ricorrente per vedere gli iscritti a prezzo fisso." />
            </BGCard>
          ) : (
            <BGCard>
              <h2 style={{ marginTop: 0 }}>Iscritti a prezzo fisso</h2>
              {enrollments.length === 0 ? (
                <BGEmptyState title="Nessun iscritto a prezzo fisso" description="Non ci sono iscrizioni attive con prezzo fisso su questo orario." />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {enrollments.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--bg-soft)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{customerFullName(item.customers)}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          € {Number(item.fixed_price).toFixed(2)} / {item.billing_cycle}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <BGInput
                          style={{ width: 130 }}
                          value={renewLabels[item.id] ?? ""}
                          onChange={(e) => setRenewLabels((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Periodo"
                        />
                        <BGInput
                          type="number"
                          step="0.01"
                          style={{ width: 100 }}
                          value={renewAmounts[item.id] ?? ""}
                          onChange={(e) => setRenewAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="€"
                        />
                        <BGSelect
                          value={renewMethods[item.id] ?? "cash"}
                          onChange={(e) => setRenewMethods((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        >
                          <option value="cash">Contanti</option>
                          <option value="pos">POS</option>
                          <option value="bank_transfer">Bonifico</option>
                        </BGSelect>
                        <BGButton onClick={() => renewEnrollment(item.id)} disabled={busyEnrollmentId === item.id}>
                          {busyEnrollmentId === item.id ? "Registrazione..." : "Registra pagamento"}
                        </BGButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </BGCard>
          )}
        </div>
      )}
    </BGPageShell>
  );
}
