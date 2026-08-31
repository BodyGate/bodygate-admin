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

type CourseType = {
  id: string;
  name: string;
  slug: string;
  default_duration_minutes: number;
  default_capacity: number;
  color: string;
  requires_medical_certificate: boolean;
  requires_active_subscription: boolean;
  booking_enabled: boolean;
  waitlist_enabled: boolean;
  cancellation_cutoff_minutes: number;
  default_price: number | null;
  is_active: boolean;
};

type CourseRoom = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  is_active: boolean;
};

type CourseSchedule = {
  id: string;
  course_type_id: string;
  room_id: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  valid_from: string;
  valid_until: string | null;
  status: string;
  course_types?: { id: string; name: string; color: string } | null;
  course_rooms?: { id: string; name: string } | null;
};

const WEEKDAYS = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
  { value: 7, label: "Domenica" },
];

async function postJson(url: string, body: Record<string, unknown>) {
  const idempotencyKey = safeRandomId("courses-admin");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok && result?.ok, result };
}

function todayLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysLocal(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CoursesAdminClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [activeTab, setActiveTab] = useState<"types" | "rooms" | "schedules">("types");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [rooms, setRooms] = useState<CourseRoom[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);

  const [typeForm, setTypeForm] = useState({
    name: "",
    default_duration_minutes: "50",
    default_capacity: "1",
    color: "#dc2626",
    requires_medical_certificate: true,
    requires_active_subscription: false,
    booking_enabled: true,
    waitlist_enabled: true,
    cancellation_cutoff_minutes: "120",
    default_price: "",
  });
  const [savingType, setSavingType] = useState(false);

  const [roomForm, setRoomForm] = useState({ name: "", description: "", capacity: "10" });
  const [savingRoom, setSavingRoom] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    course_type_id: "",
    room_id: "",
    weekday: "1",
    start_time: "18:00",
    duration_minutes: "50",
    capacity: "1",
    valid_from: todayLocalDate(),
    valid_until: "",
    generation_horizon_days: "60",
    status: "active",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [generatingScheduleId, setGeneratingScheduleId] = useState("");

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) loadAll(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function loadBranches() {
    const response = await fetch("/api/settings/branches", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const list = result?.ok ? (result.branches as Branch[]) : [];
    setBranches(list);
    if (list.length > 0) setBranchId(list[0].id);
    setLoading(false);
  }

  async function loadAll(currentBranchId: string) {
    setLoading(true);

    const [typesRes, roomsRes, schedulesRes] = await Promise.all([
      fetch(`/api/courses/types?branch_id=${encodeURIComponent(currentBranchId)}`, { cache: "no-store" }),
      fetch(`/api/courses/rooms?branch_id=${encodeURIComponent(currentBranchId)}`, { cache: "no-store" }),
      fetch(`/api/courses/schedules?branch_id=${encodeURIComponent(currentBranchId)}`, { cache: "no-store" }),
    ]);

    const [typesJson, roomsJson, schedulesJson] = await Promise.all([
      typesRes.json().catch(() => null),
      roomsRes.json().catch(() => null),
      schedulesRes.json().catch(() => null),
    ]);

    setCourseTypes(typesJson?.ok ? typesJson.course_types : []);
    setRooms(roomsJson?.ok ? roomsJson.course_rooms : []);
    setSchedules(schedulesJson?.ok ? schedulesJson.course_schedules : []);
    setLoading(false);
  }

  const activeRooms = useMemo(() => rooms.filter((room) => room.is_active), [rooms]);
  const activeCourseTypes = useMemo(() => courseTypes.filter((type) => type.is_active), [courseTypes]);

  async function createType() {
    if (!branchId) return;
    if (!typeForm.name.trim()) {
      setMessage("Inserisci il nome del tipo corso.");
      return;
    }

    setSavingType(true);
    setMessage("");

    const slug = typeForm.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { ok, result } = await postJson("/api/courses/types", {
      branch_id: branchId,
      name: typeForm.name.trim(),
      slug,
      default_duration_minutes: Number(typeForm.default_duration_minutes) || 50,
      default_capacity: Number(typeForm.default_capacity) || 1,
      color: typeForm.color,
      requires_medical_certificate: typeForm.requires_medical_certificate,
      requires_active_subscription: typeForm.requires_active_subscription,
      booking_enabled: typeForm.booking_enabled,
      waitlist_enabled: typeForm.waitlist_enabled,
      cancellation_cutoff_minutes: Number(typeForm.cancellation_cutoff_minutes) || 120,
      default_price: typeForm.default_price.trim() ? Number(typeForm.default_price) : null,
    });

    setSavingType(false);

    if (!ok) {
      setMessage(result?.error || "Errore creazione tipo corso.");
      return;
    }

    setTypeForm((prev) => ({ ...prev, name: "", default_price: "" }));
    setMessage("Tipo corso creato.");
    await loadAll(branchId);
  }

  async function createRoom() {
    if (!branchId) return;
    if (!roomForm.name.trim()) {
      setMessage("Inserisci il nome della sala.");
      return;
    }

    setSavingRoom(true);
    setMessage("");

    const { ok, result } = await postJson("/api/courses/rooms", {
      branch_id: branchId,
      name: roomForm.name.trim(),
      description: roomForm.description.trim() || null,
      capacity: Number(roomForm.capacity) || 1,
    });

    setSavingRoom(false);

    if (!ok) {
      setMessage(result?.error || "Errore creazione sala.");
      return;
    }

    setRoomForm({ name: "", description: "", capacity: "10" });
    setMessage("Sala creata.");
    await loadAll(branchId);
  }

  async function createSchedule() {
    if (!branchId) return;
    if (!scheduleForm.course_type_id) {
      setMessage("Seleziona un tipo corso.");
      return;
    }
    if (!scheduleForm.room_id) {
      setMessage("Seleziona una sala.");
      return;
    }

    setSavingSchedule(true);
    setMessage("");

    const { ok, result } = await postJson("/api/courses/schedules", {
      branch_id: branchId,
      course_type_id: scheduleForm.course_type_id,
      room_id: scheduleForm.room_id,
      weekday: Number(scheduleForm.weekday),
      start_time: scheduleForm.start_time,
      duration_minutes: Number(scheduleForm.duration_minutes) || 50,
      capacity: Number(scheduleForm.capacity) || 1,
      valid_from: scheduleForm.valid_from,
      valid_until: scheduleForm.valid_until.trim() || null,
      generation_horizon_days: Number(scheduleForm.generation_horizon_days) || 60,
      status: scheduleForm.status,
    });

    setSavingSchedule(false);

    if (!ok) {
      setMessage(result?.error || "Errore creazione orario corso.");
      return;
    }

    setMessage("Orario corso creato.");
    await loadAll(branchId);
  }

  async function generateSessions(scheduleId: string) {
    setGeneratingScheduleId(scheduleId);
    setMessage("");

    const dateFrom = todayLocalDate();
    const dateTo = addDaysLocal(dateFrom, 60);

    const { ok, result } = await postJson(`/api/courses/schedules/${scheduleId}/generate-sessions`, {
      date_from: dateFrom,
      date_to: dateTo,
    });

    setGeneratingScheduleId("");

    if (!ok) {
      setMessage(result?.error || "Errore generazione sessioni.");
      return;
    }

    const created = result?.created_count ?? 0;
    const existing = result?.existing_count ?? 0;
    const syncedCount = result?.enrollment_sync?.created_count ?? 0;
    setMessage(
      `Generate ${created} nuove sessioni (${existing} già esistenti). Prenotazioni automatiche create per gli iscritti fissi: ${syncedCount}.`,
    );
  }

  return (
    <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate · Corsi"
        title="Amministrazione corsi"
        subtitle="Tipi corso, sale e orari ricorrenti. Da qui si generano le sessioni che poi compaiono nel calendario e sono prenotabili."
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
        <BGButton variant={activeTab === "types" ? "primary" : "secondary"} onClick={() => setActiveTab("types")}>
          Tipi corso
        </BGButton>
        <BGButton variant={activeTab === "rooms" ? "primary" : "secondary"} onClick={() => setActiveTab("rooms")}>
          Sale
        </BGButton>
        <BGButton variant={activeTab === "schedules" ? "primary" : "secondary"} onClick={() => setActiveTab("schedules")}>
          Orari
        </BGButton>
      </div>

      {message && (
        <BGCard variant="soft" style={{ marginBottom: 18 }}>
          {message}
        </BGCard>
      )}

      {loading ? (
        <BGCard>
          <BGEmptyState title="Caricamento..." description="Recupero dati corsi in corso." />
        </BGCard>
      ) : !branchId ? (
        <BGCard>
          <BGEmptyState title="Nessuna sede attiva" description="Configura almeno una sede prima di gestire i corsi." />
        </BGCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 20, alignItems: "start" }}>
          <BGCard>
            {activeTab === "types" && (
              <>
                <h2 style={{ marginTop: 0 }}>Tipi corso</h2>
                {activeCourseTypes.length === 0 ? (
                  <BGEmptyState title="Nessun tipo corso" description="Crea il primo tipo corso dal pannello a destra." />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {courseTypes.map((type) => (
                      <div
                        key={type.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          border: "1px solid var(--border)",
                          background: "var(--bg-soft)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: type.color,
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700 }}>{type.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {type.default_duration_minutes} min · capienza {type.default_capacity}
                              {type.default_price ? ` · € ${Number(type.default_price).toFixed(2)}` : ""}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {type.requires_medical_certificate && <BGStatusBadge tone="warning">Certificato</BGStatusBadge>}
                          {type.requires_active_subscription && <BGStatusBadge tone="info">Abbonamento</BGStatusBadge>}
                          {!type.is_active && <BGStatusBadge tone="danger">Non attivo</BGStatusBadge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "rooms" && (
              <>
                <h2 style={{ marginTop: 0 }}>Sale</h2>
                {rooms.length === 0 ? (
                  <BGEmptyState title="Nessuna sala" description="Crea la prima sala dal pannello a destra." />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {rooms.map((room) => (
                      <div
                        key={room.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          border: "1px solid var(--border)",
                          background: "var(--bg-soft)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{room.name}</div>
                          {room.description && (
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{room.description}</div>
                          )}
                        </div>
                        <BGStatusBadge tone={room.is_active ? "success" : "danger"}>
                          Capienza {room.capacity}
                        </BGStatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "schedules" && (
              <>
                <h2 style={{ marginTop: 0 }}>Orari ricorrenti</h2>
                {schedules.length === 0 ? (
                  <BGEmptyState
                    title="Nessun orario"
                    description="Crea prima almeno un tipo corso e una sala, poi imposta l'orario ricorrente."
                  />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {schedules.map((schedule) => (
                      <div
                        key={schedule.id}
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
                          <div style={{ fontWeight: 700 }}>
                            {schedule.course_types?.name || "Corso"} · {schedule.course_rooms?.name || "Sala"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {WEEKDAYS.find((w) => w.value === schedule.weekday)?.label} {schedule.start_time.slice(0, 5)}
                            {" · "}
                            {schedule.duration_minutes} min · capienza {schedule.capacity}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <BGStatusBadge tone={schedule.status === "active" ? "success" : "neutral"}>
                            {schedule.status}
                          </BGStatusBadge>
                          <BGButton
                            variant="secondary"
                            onClick={() => generateSessions(schedule.id)}
                            disabled={generatingScheduleId === schedule.id || schedule.status !== "active"}
                          >
                            {generatingScheduleId === schedule.id ? "Generazione..." : "Genera sessioni (60gg)"}
                          </BGButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </BGCard>

          <BGCard variant="soft">
            {activeTab === "types" && (
              <>
                <h3 style={{ marginTop: 0 }}>Nuovo tipo corso</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Nome
                    <BGInput
                      value={typeForm.name}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Es. Pilates"
                    />
                  </label>
                  <label>
                    Durata (minuti)
                    <BGInput
                      type="number"
                      value={typeForm.default_duration_minutes}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, default_duration_minutes: e.target.value }))}
                    />
                  </label>
                  <label>
                    Capienza
                    <BGInput
                      type="number"
                      value={typeForm.default_capacity}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, default_capacity: e.target.value }))}
                    />
                  </label>
                  <label>
                    Prezzo a lezione (€, opzionale)
                    <BGInput
                      type="number"
                      step="0.01"
                      value={typeForm.default_price}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, default_price: e.target.value }))}
                      placeholder="Lascia vuoto se solo iscrizione fissa"
                    />
                  </label>
                  <label>
                    Colore
                    <BGInput
                      type="color"
                      value={typeForm.color}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, color: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={typeForm.requires_medical_certificate}
                      onChange={(e) =>
                        setTypeForm((prev) => ({ ...prev, requires_medical_certificate: e.target.checked }))
                      }
                    />
                    Richiede certificato medico
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={typeForm.requires_active_subscription}
                      onChange={(e) =>
                        setTypeForm((prev) => ({ ...prev, requires_active_subscription: e.target.checked }))
                      }
                    />
                    Richiede abbonamento attivo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={typeForm.waitlist_enabled}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, waitlist_enabled: e.target.checked }))}
                    />
                    Lista d&apos;attesa abilitata
                  </label>
                  <BGButton onClick={createType} disabled={savingType}>
                    {savingType ? "Salvataggio..." : "Crea tipo corso"}
                  </BGButton>
                </div>
              </>
            )}

            {activeTab === "rooms" && (
              <>
                <h3 style={{ marginTop: 0 }}>Nuova sala</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Nome
                    <BGInput
                      value={roomForm.name}
                      onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Es. Sala Pilates"
                    />
                  </label>
                  <label>
                    Descrizione
                    <BGInput
                      value={roomForm.description}
                      onChange={(e) => setRoomForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </label>
                  <label>
                    Capienza
                    <BGInput
                      type="number"
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm((prev) => ({ ...prev, capacity: e.target.value }))}
                    />
                  </label>
                  <BGButton onClick={createRoom} disabled={savingRoom}>
                    {savingRoom ? "Salvataggio..." : "Crea sala"}
                  </BGButton>
                </div>
              </>
            )}

            {activeTab === "schedules" && (
              <>
                <h3 style={{ marginTop: 0 }}>Nuovo orario ricorrente</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <label>
                    Tipo corso
                    <BGSelect
                      value={scheduleForm.course_type_id}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, course_type_id: e.target.value }))}
                    >
                      <option value="">Seleziona...</option>
                      {activeCourseTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </BGSelect>
                  </label>
                  <label>
                    Sala
                    <BGSelect
                      value={scheduleForm.room_id}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, room_id: e.target.value }))}
                    >
                      <option value="">Seleziona...</option>
                      {activeRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} (capienza {room.capacity})
                        </option>
                      ))}
                    </BGSelect>
                  </label>
                  <label>
                    Giorno
                    <BGSelect
                      value={scheduleForm.weekday}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, weekday: e.target.value }))}
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </BGSelect>
                  </label>
                  <label>
                    Orario inizio
                    <BGInput
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    />
                  </label>
                  <label>
                    Durata (minuti)
                    <BGInput
                      type="number"
                      value={scheduleForm.duration_minutes}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                    />
                  </label>
                  <label>
                    Capienza sessione
                    <BGInput
                      type="number"
                      value={scheduleForm.capacity}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, capacity: e.target.value }))}
                    />
                  </label>
                  <label>
                    Valido dal
                    <BGInput
                      type="date"
                      value={scheduleForm.valid_from}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                    />
                  </label>
                  <label>
                    Valido fino al (opzionale)
                    <BGInput
                      type="date"
                      value={scheduleForm.valid_until}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                    />
                  </label>
                  <label>
                    Stato
                    <BGSelect
                      value={scheduleForm.status}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="draft">Bozza</option>
                      <option value="active">Attivo</option>
                    </BGSelect>
                  </label>
                  <BGButton onClick={createSchedule} disabled={savingSchedule}>
                    {savingSchedule ? "Salvataggio..." : "Crea orario"}
                  </BGButton>
                </div>
              </>
            )}
          </BGCard>
        </div>
      )}
    </BGPageShell>
  );
}
