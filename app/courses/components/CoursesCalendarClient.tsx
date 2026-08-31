"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BGButton,
  BGCard,
  BGEmptyState,
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
  branch_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  confirmed_count: number;
  waitlisted_count: number;
  course_types?: { id: string; name: string; color: string; default_price: number | null } | null;
  course_rooms?: { id: string; name: string } | null;
  staff_users?: { id: string; full_name: string } | null;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const idempotencyKey = safeRandomId("courses-calendar");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok && result?.ok, result };
}

function toLocalDateKey(isoValue: string) {
  const date = new Date(isoValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(reference: Date) {
  const date = new Date(reference);
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - weekday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const end = new Date(endsAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${start} - ${end}`;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  scheduled: "success",
  open: "success",
  closed: "warning",
  cancelled: "danger",
  completed: "neutral",
};

const ACTIONABLE_SESSION_STATUSES = new Set(["scheduled", "open", "closed"]);

export default function CoursesCalendarClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busySessionId, setBusySessionId] = useState("");

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) loadSessions(branchId, weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, weekStart]);

  async function loadBranches() {
    const response = await fetch("/api/settings/branches", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list = result?.ok ? (result.branches as Branch[]) : [];
    setBranches(list);
    if (list.length > 0) setBranchId(list[0].id);
    setLoading(false);
  }

  async function loadSessions(currentBranchId: string, currentWeekStart: Date) {
    setLoading(true);
    setMessage("");

    const from = new Date(currentWeekStart);
    const to = new Date(currentWeekStart);
    to.setDate(to.getDate() + 7);

    const params = new URLSearchParams({
      branch_id: currentBranchId,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const response = await fetch(`/api/courses/sessions?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    setSessions(result?.ok ? result.course_sessions : []);
    setLoading(false);
  }

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, CourseSession[]>();
    for (const session of sessions) {
      const key = toLocalDateKey(session.starts_at);
      const existing = grouped.get(key) || [];
      existing.push(session);
      grouped.set(key, existing);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return grouped;
  }, [sessions]);

  async function cancelSession(sessionId: string) {
    if (!window.confirm("Annullare questa sessione? Le prenotazioni collegate verranno annullate.")) return;

    setBusySessionId(sessionId);
    const { ok, result } = await postJson(`/api/courses/sessions/${sessionId}/cancel`, {
      reason: "Annullata da calendario",
    });
    setBusySessionId("");

    if (!ok) {
      setMessage(result?.error || "Errore annullamento sessione.");
      return;
    }

    setMessage("Sessione annullata.");
    await loadSessions(branchId, weekStart);
  }

  async function completeSession(sessionId: string) {
    setBusySessionId(sessionId);
    const { ok, result } = await postJson(`/api/courses/sessions/${sessionId}/complete`, {});
    setBusySessionId("");

    if (!ok) {
      setMessage(result?.error || "Errore completamento sessione.");
      return;
    }

    setMessage("Sessione completata.");
    await loadSessions(branchId, weekStart);
  }

  return (
    <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate · Corsi"
        title="Calendario corsi"
        subtitle="Sessioni generate dagli orari ricorrenti, settimana per settimana."
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

      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        <BGButton
          variant="secondary"
          onClick={() => setWeekStart((prev) => { const next = new Date(prev); next.setDate(next.getDate() - 7); return next; })}
        >
          Settimana precedente
        </BGButton>
        <BGButton variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          Oggi
        </BGButton>
        <BGButton
          variant="secondary"
          onClick={() => setWeekStart((prev) => { const next = new Date(prev); next.setDate(next.getDate() + 7); return next; })}
        >
          Settimana successiva
        </BGButton>
      </div>

      {message && (
        <BGCard variant="soft" style={{ marginBottom: 18 }}>
          {message}
        </BGCard>
      )}

      {loading ? (
        <BGCard>
          <BGEmptyState title="Caricamento..." description="Recupero sessioni corso in corso." />
        </BGCard>
      ) : !branchId ? (
        <BGCard>
          <BGEmptyState title="Nessuna sede attiva" description="Configura almeno una sede prima di gestire i corsi." />
        </BGCard>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {days.map((day) => {
            const key = toLocalDateKey(day.toISOString());
            const daySessions = sessionsByDay.get(key) || [];

            return (
              <BGCard key={key}>
                <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>{formatDayLabel(day)}</h2>
                {daySessions.length === 0 ? (
                  <p style={{ color: "var(--muted)", margin: 0 }}>Nessuna sessione.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: session.course_types?.color || "#71717a",
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              {session.course_types?.name || "Corso"} · {formatTimeRange(session.starts_at, session.ends_at)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {session.course_rooms?.name || "Sala"}
                              {session.staff_users?.full_name ? ` · ${session.staff_users.full_name}` : ""}
                              {" · "}
                              {session.confirmed_count}/{session.capacity} confermati
                              {session.waitlisted_count > 0 ? ` · ${session.waitlisted_count} in lista d'attesa` : ""}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <BGStatusBadge tone={STATUS_TONE[session.status] || "neutral"}>{session.status}</BGStatusBadge>
                          {ACTIONABLE_SESSION_STATUSES.has(session.status) && (
                            <>
                              <BGButton
                                variant="secondary"
                                onClick={() => completeSession(session.id)}
                                disabled={busySessionId === session.id}
                              >
                                Completa
                              </BGButton>
                              <BGButton
                                variant="secondary"
                                onClick={() => cancelSession(session.id)}
                                disabled={busySessionId === session.id}
                              >
                                Annulla
                              </BGButton>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BGCard>
            );
          })}
        </div>
      )}
    </BGPageShell>
  );
}
