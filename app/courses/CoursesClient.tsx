"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  RefreshCcw,
  Users,
} from "lucide-react";
import BGButton from "../components/ui/BGButton";
import BGCard from "../components/ui/BGCard";
import BGDataTable from "../components/ui/BGDataTable";
import BGEmptyState from "../components/ui/BGEmptyState";
import BGPageHeader from "../components/ui/BGPageHeader";
import BGStatusBadge from "../components/ui/BGStatusBadge";
import CourseSetupPanel from "./CourseSetupPanel";
import "./courses.css";

type CourseSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  notes: string | null;
  course_type: {
    id: string;
    name: string;
    color: string;
  } | null;
  room: {
    id: string;
    name: string;
  } | null;
  instructor: {
    id: string;
    full_name: string;
  } | null;
  bookings: {
    confirmed: number;
    waitlisted: number;
    attended: number;
    no_show: number;
    occupied: number;
    available: number;
  };
};

type OverviewPayload = {
  ok: boolean;
  error?: string;
  generated_at: string;
  branch: {
    id: string;
    name?: string | null;
  };
  permissions: {
    can_manage_courses: boolean;
    can_manage_bookings: boolean;
  };
  kpis: {
    active_course_types: number;
    active_rooms: number;
    active_schedules: number;
    open_sessions: number;
    confirmed_bookings: number;
    waitlisted_bookings: number;
  };
  sessions: CourseSession[];
};

function localDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sessionTone(status: string) {
  if (status === "open") return "success";
  if (status === "scheduled") return "info";
  if (status === "completed") return "neutral";
  if (status === "cancelled") return "danger";
  return "warning";
}

function sessionLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: "Programmata",
    open: "Aperta",
    closed: "Chiusa",
    completed: "Completata",
    cancelled: "Annullata",
  };

  return labels[status] || status;
}

export default function CoursesClient() {
  const initialFrom = useMemo(() => new Date(), []);
  const initialTo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }, []);

  const [dateFrom, setDateFrom] = useState(
    localDateInput(initialFrom),
  );
  const [dateTo, setDateTo] = useState(
    localDateInput(initialTo),
  );
  const [payload, setPayload] =
    useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      });

      const response = await fetch(
        `/api/courses/overview?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const result = (await response.json()) as OverviewPayload;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Calendario corsi non disponibile.",
        );
      }

      setPayload(result);
    } catch (loadError: unknown) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Errore caricamento corsi.",
      );
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const kpis = payload?.kpis;

  return (
    <main className="courses-page">
      <BGPageHeader
        eyebrow="BodyGate Courses"
        title="Corsi & Prenotazioni"
        subtitle="Calendario operativo, capienza, presenze e lista d’attesa in un’unica regia Premium."
        actions={
          <BGButton
            variant="secondary"
            onClick={() => void loadOverview()}
            disabled={loading}
          >
            <RefreshCcw size={17} />
            Aggiorna
          </BGButton>
        }
      />

      <section className="courses-filter-card">
        <label>
          <span>Dal</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>

        <label>
          <span>Al</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>

        <div className="courses-filter-copy">
          <strong>
            {payload?.branch?.name || "Sede operativa"}
          </strong>
          <span>
            Vista calendario fino a 250 lezioni per intervallo.
          </span>
        </div>
      </section>

      {error ? (
        <BGCard variant="danger">
          <div className="courses-error">
            <div>
              <span>Calendario non disponibile</span>
              <strong>{error}</strong>
            </div>
            <BGButton
              variant="secondary"
              onClick={() => void loadOverview()}
            >
              Riprova
            </BGButton>
          </div>
        </BGCard>
      ) : null}

      <section className="courses-kpis">
        <BGCard variant="soft">
          <CalendarDays size={22} />
          <span>Tipologie attive</span>
          <strong>{kpis?.active_course_types ?? "—"}</strong>
        </BGCard>

        <BGCard variant="soft">
          <DoorOpen size={22} />
          <span>Sale attive</span>
          <strong>{kpis?.active_rooms ?? "—"}</strong>
        </BGCard>

        <BGCard variant="soft">
          <Clock3 size={22} />
          <span>Lezioni aperte</span>
          <strong>{kpis?.open_sessions ?? "—"}</strong>
        </BGCard>

        <BGCard variant="soft">
          <CheckCircle2 size={22} />
          <span>Prenotazioni</span>
          <strong>{kpis?.confirmed_bookings ?? "—"}</strong>
        </BGCard>

        <BGCard variant="soft">
          <Users size={22} />
          <span>Lista d’attesa</span>
          <strong>{kpis?.waitlisted_bookings ?? "—"}</strong>
        </BGCard>
      </section>

      {payload ? (
        <CourseSetupPanel
          canManage={payload.permissions.can_manage_courses}
          onChanged={() => void loadOverview()}
        />
      ) : null}

      <BGCard variant="premium">
        <div className="courses-section-header">
          <div>
            <span>Calendario operativo</span>
            <h2>Prossime lezioni</h2>
          </div>

          {payload ? (
            <BGStatusBadge tone="info">
              {`${payload.sessions.length} lezioni`}
            </BGStatusBadge>
          ) : null}
        </div>

        {loading ? (
          <div className="courses-loading">
            Caricamento calendario corsi…
          </div>
        ) : null}

        {!loading && payload && payload.sessions.length === 0 ? (
          <BGEmptyState
            title="Nessuna lezione nel periodo selezionato"
            description="Crea una programmazione e genera le sessioni per iniziare a gestire il calendario."
          />
        ) : null}

        {!loading && payload && payload.sessions.length > 0 ? (
          <BGDataTable minWidth={1100}>
            <table>
              <thead>
                <tr>
                  <th>Data e ora</th>
                  <th>Corso</th>
                  <th>Sala</th>
                  <th>Istruttore</th>
                  <th>Capienza</th>
                  <th>Waitlist</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {payload.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <div className="courses-date-cell">
                        <strong>
                          {formatDateTime(session.starts_at)}
                        </strong>
                        <span>
                          fino alle {formatTime(session.ends_at)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="courses-type-cell">
                        <i
                          style={{
                            background:
                              session.course_type?.color ||
                              "#dc2626",
                          }}
                        />
                        <strong>
                          {session.course_type?.name ||
                            "Corso non configurato"}
                        </strong>
                      </div>
                    </td>
                    <td>
                      {session.room?.name || "Sala non assegnata"}
                    </td>
                    <td>
                      {session.instructor?.full_name ||
                        "Da assegnare"}
                    </td>
                    <td>
                      <div className="courses-capacity">
                        <strong>
                          {session.bookings.occupied}/
                          {session.capacity}
                        </strong>
                        <span>
                          {session.bookings.available} posti liberi
                        </span>
                      </div>
                    </td>
                    <td>
                      <BGStatusBadge
                        tone={
                          session.bookings.waitlisted > 0
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {String(session.bookings.waitlisted)}
                      </BGStatusBadge>
                    </td>
                    <td>
                      <BGStatusBadge
                        tone={sessionTone(session.status)}
                      >
                        {sessionLabel(session.status)}
                      </BGStatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BGDataTable>
        ) : null}
      </BGCard>
    </main>
  );
}


