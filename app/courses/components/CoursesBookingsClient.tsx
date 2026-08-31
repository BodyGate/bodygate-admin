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
import CustomerPicker from "./CustomerPicker";

type Branch = { id: string; name: string; city?: string | null };
type CustomerOption = { id: string; full_name: string; phone?: string | null };

type CourseSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  confirmed_count: number;
  waitlisted_count: number;
  course_types?: { id: string; name: string; color: string } | null;
  course_rooms?: { id: string; name: string } | null;
};

type CourseBooking = {
  id: string;
  status: string;
  waitlist_position: number | null;
  booked_at: string;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

type CourseSchedule = {
  id: string;
  weekday: number;
  start_time: string;
  status: string;
  course_types?: { id: string; name: string; color: string } | null;
  course_rooms?: { id: string; name: string } | null;
};

type CourseEnrollment = {
  id: string;
  status: string;
  pricing_mode: string;
  fixed_price: number | null;
  billing_cycle: string;
  enrolled_at: string;
  customers?: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

const WEEKDAYS = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const BOOKING_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  confirmed: "success",
  waitlisted: "warning",
  attended: "success",
  no_show: "danger",
  cancelled: "danger",
};

const ENROLLMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  paused: "warning",
  cancelled: "danger",
};

async function postJson(url: string, body: Record<string, unknown>) {
  const idempotencyKey = safeRandomId("courses-bookings");
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

export default function CoursesBookingsClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [activeTab, setActiveTab] = useState<"bookings" | "enrollments">("bookings");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [message, setMessage] = useState("");

  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [bookings, setBookings] = useState<CourseBooking[]>([]);
  const [bookingCustomer, setBookingCustomer] = useState<CustomerOption | null>(null);
  const [booking, setBooking] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState("");

  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [enrollmentCustomer, setEnrollmentCustomer] = useState<CustomerOption | null>(null);
  const [pricingMode, setPricingMode] = useState<"fixed" | "per_session">("fixed");
  const [fixedPrice, setFixedPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [enrolling, setEnrolling] = useState(false);
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

  function handleSessionChange(value: string) {
    setSessionId(value);
    if (!value) setBookings([]);
  }

  function handleScheduleChange(value: string) {
    setScheduleId(value);
    if (!value) setEnrollments([]);
  }

  async function loadBranches() {
    const response = await fetch("/api/settings/branches", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list = result?.ok ? (result.branches as Branch[]) : [];
    setBranches(list);
    if (list.length > 0) setBranchId(list[0].id);
    setLoadingBranches(false);
  }

  async function loadSessions(currentBranchId: string) {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const params = new URLSearchParams({ branch_id: currentBranchId, from, to });
    const response = await fetch(`/api/courses/sessions?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list: CourseSession[] = result?.ok ? result.course_sessions : [];
    setSessions(list.filter((session) => session.status === "scheduled"));
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
    setBookings(result?.ok ? result.course_bookings : []);
  }

  async function loadEnrollments(currentScheduleId: string) {
    const response = await fetch(`/api/courses/enrollments?schedule_id=${encodeURIComponent(currentScheduleId)}`, {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    setEnrollments(result?.ok ? result.course_enrollments : []);
  }

  const selectedSession = useMemo(() => sessions.find((s) => s.id === sessionId) || null, [sessions, sessionId]);
  const selectedSchedule = useMemo(() => schedules.find((s) => s.id === scheduleId) || null, [schedules, scheduleId]);

  async function createBooking() {
    if (!sessionId || !bookingCustomer) {
      setMessage("Seleziona una sessione e un cliente.");
      return;
    }

    setBooking(true);
    setMessage("");

    const { ok, result } = await postJson("/api/courses/bookings", {
      session_id: sessionId,
      customer_id: bookingCustomer.id,
      booking_source: "reception",
    });

    setBooking(false);

    if (!ok) {
      setMessage(result?.error || "Errore prenotazione.");
      return;
    }

    setBookingCustomer(null);
    setMessage("Prenotazione registrata.");
    await Promise.all([loadBookings(sessionId), loadSessions(branchId)]);
  }

  async function cancelBooking(bookingId: string) {
    if (!window.confirm("Annullare questa prenotazione?")) return;

    setBusyBookingId(bookingId);
    const { ok, result } = await postJson(`/api/courses/bookings/${bookingId}/cancel`, {});
    setBusyBookingId("");

    if (!ok) {
      setMessage(result?.error || "Errore annullamento prenotazione.");
      return;
    }

    setMessage("Prenotazione annullata.");
    await Promise.all([loadBookings(sessionId), loadSessions(branchId)]);
  }

  async function checkInBooking(bookingId: string) {
    setBusyBookingId(bookingId);
    const { ok, result } = await postJson(`/api/courses/bookings/${bookingId}/check-in`, {});
    setBusyBookingId("");

    if (!ok) {
      setMessage(result?.error || "Errore check-in.");
      return;
    }

    setMessage("Check-in registrato.");
    await loadBookings(sessionId);
  }

  async function createEnrollment() {
    if (!scheduleId || !enrollmentCustomer) {
      setMessage("Seleziona un orario ricorrente e un cliente.");
      return;
    }
    if (pricingMode === "fixed" && !fixedPrice.trim()) {
      setMessage("Inserisci il prezzo fisso.");
      return;
    }

    setEnrolling(true);
    setMessage("");

    const { ok, result } = await postJson("/api/courses/enrollments", {
      schedule_id: scheduleId,
      customer_id: enrollmentCustomer.id,
      pricing_mode: pricingMode,
      fixed_price: pricingMode === "fixed" ? Number(fixedPrice) : null,
      payment_method: pricingMode === "fixed" ? paymentMethod : null,
      billing_cycle: billingCycle,
    });

    setEnrolling(false);

    if (!ok) {
      setMessage(result?.error || "Errore iscrizione.");
      return;
    }

    setEnrollmentCustomer(null);
    setFixedPrice("");
    setMessage("Iscrizione creata.");
    await loadEnrollments(scheduleId);
  }

  async function cancelEnrollment(enrollmentId: string) {
    if (!window.confirm("Annullare questa iscrizione? Le prenotazioni future collegate verranno annullate.")) return;

    setBusyEnrollmentId(enrollmentId);
    const { ok, result } = await postJson(`/api/courses/enrollments/${enrollmentId}/cancel`, {});
    setBusyEnrollmentId("");

    if (!ok) {
      setMessage(result?.error || "Errore annullamento iscrizione.");
      return;
    }

    setMessage("Iscrizione annullata.");
    await loadEnrollments(scheduleId);
  }

  return (
    <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate · Corsi"
        title="Prenotazioni e iscrizioni"
        subtitle="Prenotazione per singola sessione o iscrizione a orario fisso ricorrente."
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
        <BGButton variant={activeTab === "bookings" ? "primary" : "secondary"} onClick={() => setActiveTab("bookings")}>
          Prenotazioni per sessione
        </BGButton>
        <BGButton variant={activeTab === "enrollments" ? "primary" : "secondary"} onClick={() => setActiveTab("enrollments")}>
          Iscrizioni a orario fisso
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
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 20, alignItems: "start" }}>
          {activeTab === "bookings" ? (
            <>
              <BGCard>
                <h2 style={{ marginTop: 0 }}>Prenotazioni</h2>
                {!sessionId ? (
                  <BGEmptyState title="Seleziona una sessione" description="Scegli una sessione dal pannello a destra per vedere le prenotazioni." />
                ) : bookings.length === 0 ? (
                  <BGEmptyState title="Nessuna prenotazione" description="Nessuno ha ancora prenotato questa sessione." />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {bookings.map((item) => (
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
                            {item.customers?.phone || ""}
                            {item.waitlist_position ? ` · posizione lista ${item.waitlist_position}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <BGStatusBadge tone={BOOKING_STATUS_TONE[item.status] || "neutral"}>{item.status}</BGStatusBadge>
                          {item.status === "confirmed" && (
                            <BGButton variant="secondary" onClick={() => checkInBooking(item.id)} disabled={busyBookingId === item.id}>
                              Check-in
                            </BGButton>
                          )}
                          {(item.status === "confirmed" || item.status === "waitlisted") && (
                            <BGButton variant="secondary" onClick={() => cancelBooking(item.id)} disabled={busyBookingId === item.id}>
                              Annulla
                            </BGButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BGCard>

              <BGCard variant="soft">
                <h3 style={{ marginTop: 0 }}>Nuova prenotazione</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Sessione
                    <BGSelect value={sessionId} onChange={(e) => handleSessionChange(e.target.value)}>
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
                          {session.course_types?.name || "Corso"} ({session.confirmed_count}/{session.capacity})
                        </option>
                      ))}
                    </BGSelect>
                  </label>
                  {selectedSession && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {selectedSession.course_rooms?.name || "Sala"} · {selectedSession.confirmed_count}/{selectedSession.capacity} confermati
                      {selectedSession.waitlisted_count > 0 ? ` · ${selectedSession.waitlisted_count} in lista d'attesa` : ""}
                    </div>
                  )}
                  <label>Cliente</label>
                  <CustomerPicker selected={bookingCustomer} onSelect={setBookingCustomer} />
                  <BGButton onClick={createBooking} disabled={booking}>
                    {booking ? "Prenotazione..." : "Prenota"}
                  </BGButton>
                </div>
              </BGCard>
            </>
          ) : (
            <>
              <BGCard>
                <h2 style={{ marginTop: 0 }}>Iscritti</h2>
                {!scheduleId ? (
                  <BGEmptyState title="Seleziona un orario" description="Scegli un orario ricorrente dal pannello a destra per vedere gli iscritti." />
                ) : enrollments.length === 0 ? (
                  <BGEmptyState title="Nessun iscritto" description="Nessuno è ancora iscritto a questo orario." />
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
                            {item.pricing_mode === "fixed"
                              ? `€ ${Number(item.fixed_price).toFixed(2)} / ${item.billing_cycle}`
                              : "A lezione"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <BGStatusBadge tone={ENROLLMENT_STATUS_TONE[item.status] || "neutral"}>{item.status}</BGStatusBadge>
                          {item.status === "active" && (
                            <BGButton variant="secondary" onClick={() => cancelEnrollment(item.id)} disabled={busyEnrollmentId === item.id}>
                              Annulla
                            </BGButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BGCard>

              <BGCard variant="soft">
                <h3 style={{ marginTop: 0 }}>Nuova iscrizione</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Orario ricorrente
                    <BGSelect value={scheduleId} onChange={(e) => handleScheduleChange(e.target.value)}>
                      <option value="">Seleziona...</option>
                      {schedules.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.course_types?.name || "Corso"} · {WEEKDAYS[schedule.weekday]} {schedule.start_time.slice(0, 5)}
                        </option>
                      ))}
                    </BGSelect>
                  </label>
                  {selectedSchedule && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{selectedSchedule.course_rooms?.name || "Sala"}</div>
                  )}
                  <label>Cliente</label>
                  <CustomerPicker selected={enrollmentCustomer} onSelect={setEnrollmentCustomer} />
                  <label>
                    Modalità prezzo
                    <BGSelect value={pricingMode} onChange={(e) => setPricingMode(e.target.value as "fixed" | "per_session")}>
                      <option value="fixed">Prezzo fisso ricorrente</option>
                      <option value="per_session">A lezione (paga ogni volta)</option>
                    </BGSelect>
                  </label>
                  {pricingMode === "fixed" && (
                    <>
                      <label>
                        Prezzo (€)
                        <BGInput
                          type="number"
                          step="0.01"
                          value={fixedPrice}
                          onChange={(e) => setFixedPrice(e.target.value)}
                        />
                      </label>
                      <label>
                        Ciclo di fatturazione
                        <BGSelect value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                          <option value="monthly">Mensile</option>
                          <option value="quarterly">Trimestrale</option>
                          <option value="annual">Annuale</option>
                        </BGSelect>
                      </label>
                      <label>
                        Metodo pagamento (prima quota)
                        <BGSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                          <option value="cash">Contanti</option>
                          <option value="pos">POS</option>
                          <option value="bank_transfer">Bonifico</option>
                        </BGSelect>
                      </label>
                    </>
                  )}
                  <BGButton onClick={createEnrollment} disabled={enrolling}>
                    {enrolling ? "Iscrizione..." : "Iscrivi"}
                  </BGButton>
                </div>
              </BGCard>
            </>
          )}
        </div>
      )}
    </BGPageShell>
  );
}
