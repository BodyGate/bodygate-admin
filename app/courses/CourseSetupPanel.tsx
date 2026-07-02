"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Layers3, Plus, RefreshCcw, X } from "lucide-react";
import BGButton from "../components/ui/BGButton";
import BGCard from "../components/ui/BGCard";
import BGEmptyState from "../components/ui/BGEmptyState";
import BGInput from "../components/ui/BGInput";
import BGStatusBadge from "../components/ui/BGStatusBadge";

type CourseType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  color: string;
  booking_enabled: boolean;
  waitlist_enabled: boolean;
  is_active: boolean;
};

type CourseRoom = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  is_active: boolean;
};

type ApiPayload = {
  ok: boolean;
  error?: string;
  permissions?: {
    can_manage: boolean;
  };
  course_types?: CourseType[];
  course_rooms?: CourseRoom[];
};

type Props = {
  canManage: boolean;
  onChanged: () => void;
};

function operationKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CourseSetupPanel({
  canManage,
  onChanged,
}: Props) {
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [rooms, setRooms] = useState<CourseRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openTypeForm, setOpenTypeForm] = useState(false);
  const [openRoomForm, setOpenRoomForm] = useState(false);

  const [typeName, setTypeName] = useState("");
  const [typeSlug, setTypeSlug] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeDuration, setTypeDuration] = useState("50");
  const [typeCapacity, setTypeCapacity] = useState("1");
  const [typeColor, setTypeColor] = useState("#dc2626");
  const [typeCutoff, setTypeCutoff] = useState("120");
  const [requiresCertificate, setRequiresCertificate] =
    useState(true);
  const [requiresSubscription, setRequiresSubscription] =
    useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);

  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("1");

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [typesResponse, roomsResponse] = await Promise.all([
        fetch("/api/courses/types", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch("/api/courses/rooms", {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const typesPayload =
        (await typesResponse.json()) as ApiPayload;
      const roomsPayload =
        (await roomsResponse.json()) as ApiPayload;

      if (!typesResponse.ok || !typesPayload.ok) {
        throw new Error(
          typesPayload.error ||
            "Impossibile caricare le tipologie corso.",
        );
      }

      if (!roomsResponse.ok || !roomsPayload.ok) {
        throw new Error(
          roomsPayload.error ||
            "Impossibile caricare le sale.",
        );
      }

      setCourseTypes(typesPayload.course_types || []);
      setRooms(roomsPayload.course_rooms || []);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Errore caricamento configurazione corsi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  async function createCourseType() {
    const normalizedSlug = typeSlug || slugify(typeName);

    if (!typeName.trim() || !normalizedSlug) {
      setError("Inserisci nome e identificativo del corso.");
      return;
    }

    setSavingType(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/courses/types", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationKey("course-type-ui"),
        },
        body: JSON.stringify({
          name: typeName.trim(),
          slug: normalizedSlug,
          description: typeDescription.trim() || null,
          default_duration_minutes: Number(typeDuration),
          default_capacity: Number(typeCapacity),
          color: typeColor,
          cancellation_cutoff_minutes: Number(typeCutoff),
          requires_medical_certificate: requiresCertificate,
          requires_active_subscription: requiresSubscription,
          booking_enabled: bookingEnabled,
          waitlist_enabled: waitlistEnabled,
        }),
      });

      const result = (await response.json()) as ApiPayload;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Creazione tipologia non riuscita.",
        );
      }

      setSuccess(`Tipologia “${typeName.trim()}” creata.`);
      setTypeName("");
      setTypeSlug("");
      setTypeDescription("");
      setTypeDuration("50");
      setTypeCapacity("1");
      setTypeColor("#dc2626");
      setTypeCutoff("120");
      setOpenTypeForm(false);

      await loadConfiguration();
      onChanged();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Errore creazione tipologia.",
      );
    } finally {
      setSavingType(false);
    }
  }

  async function createRoom() {
    if (!roomName.trim()) {
      setError("Inserisci il nome della sala.");
      return;
    }

    setSavingRoom(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/courses/rooms", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationKey("course-room-ui"),
        },
        body: JSON.stringify({
          name: roomName.trim(),
          description: roomDescription.trim() || null,
          capacity: Number(roomCapacity),
        }),
      });

      const result = (await response.json()) as ApiPayload;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Creazione sala non riuscita.",
        );
      }

      setSuccess(`Sala “${roomName.trim()}” creata.`);
      setRoomName("");
      setRoomDescription("");
      setRoomCapacity("1");
      setOpenRoomForm(false);

      await loadConfiguration();
      onChanged();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Errore creazione sala.",
      );
    } finally {
      setSavingRoom(false);
    }
  }

  return (
    <section className="courses-setup">
      <div className="courses-section-header">
        <div>
          <span>Configurazione</span>
          <h2>Tipologie & Sale</h2>
        </div>

        <BGButton
          variant="ghost"
          onClick={() => void loadConfiguration()}
          disabled={loading}
        >
          <RefreshCcw size={16} />
          Ricarica
        </BGButton>
      </div>

      {error ? (
        <BGCard variant="danger">
          <div className="courses-inline-message">
            <strong>{error}</strong>
            <button type="button" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        </BGCard>
      ) : null}

      {success ? (
        <BGCard variant="success">
          <div className="courses-inline-message">
            <strong>{success}</strong>
            <button type="button" onClick={() => setSuccess("")}>
              <X size={16} />
            </button>
          </div>
        </BGCard>
      ) : null}

      <div className="courses-setup-grid">
        <BGCard variant="premium">
          <div className="courses-setup-card-header">
            <div>
              <Layers3 size={22} />
              <div>
                <span>Catalogo operativo</span>
                <h3>Tipologie corso</h3>
              </div>
            </div>

            {canManage ? (
              <BGButton
                variant={openTypeForm ? "ghost" : "secondary"}
                onClick={() => setOpenTypeForm(!openTypeForm)}
              >
                {openTypeForm ? <X size={16} /> : <Plus size={16} />}
                {openTypeForm ? "Chiudi" : "Nuova tipologia"}
              </BGButton>
            ) : null}
          </div>

          {openTypeForm ? (
            <div className="courses-form-panel">
              <div className="courses-form-grid">
                <BGInput
                  label="Nome corso"
                  value={typeName}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setTypeName(nextName);

                    if (!typeSlug || typeSlug === slugify(typeName)) {
                      setTypeSlug(slugify(nextName));
                    }
                  }}
                  placeholder="Es. Pilates Reformer"
                />

                <BGInput
                  label="Identificativo"
                  value={typeSlug}
                  onChange={(event) =>
                    setTypeSlug(slugify(event.target.value))
                  }
                  placeholder="pilates-reformer"
                  hint="Lettere minuscole, numeri e trattini."
                />

                <BGInput
                  label="Durata predefinita"
                  type="number"
                  min="1"
                  max="1440"
                  value={typeDuration}
                  onChange={(event) =>
                    setTypeDuration(event.target.value)
                  }
                />

                <BGInput
                  label="Capienza predefinita"
                  type="number"
                  min="1"
                  max="1000"
                  value={typeCapacity}
                  onChange={(event) =>
                    setTypeCapacity(event.target.value)
                  }
                />

                <BGInput
                  label="Limite cancellazione (minuti)"
                  type="number"
                  min="0"
                  max="10080"
                  value={typeCutoff}
                  onChange={(event) =>
                    setTypeCutoff(event.target.value)
                  }
                />

                <BGInput
                  label="Colore"
                  type="color"
                  value={typeColor}
                  onChange={(event) =>
                    setTypeColor(event.target.value)
                  }
                />
              </div>

              <label className="courses-textarea-field">
                <span>Descrizione</span>
                <textarea
                  value={typeDescription}
                  onChange={(event) =>
                    setTypeDescription(event.target.value)
                  }
                  placeholder="Descrizione interna del corso"
                  rows={3}
                />
              </label>

              <div className="courses-check-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={requiresCertificate}
                    onChange={(event) =>
                      setRequiresCertificate(event.target.checked)
                    }
                  />
                  Certificato medico richiesto
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={requiresSubscription}
                    onChange={(event) =>
                      setRequiresSubscription(event.target.checked)
                    }
                  />
                  Abbonamento attivo richiesto
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={bookingEnabled}
                    onChange={(event) =>
                      setBookingEnabled(event.target.checked)
                    }
                  />
                  Prenotazioni abilitate
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={waitlistEnabled}
                    onChange={(event) =>
                      setWaitlistEnabled(event.target.checked)
                    }
                  />
                  Lista d’attesa abilitata
                </label>
              </div>

              <div className="courses-form-actions">
                <BGButton
                  onClick={() => void createCourseType()}
                  disabled={savingType}
                >
                  <Plus size={17} />
                  {savingType ? "Creazione…" : "Crea tipologia"}
                </BGButton>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="courses-config-loading">
              Caricamento tipologie…
            </div>
          ) : null}

          {!loading && courseTypes.length === 0 ? (
            <BGEmptyState
              title="Nessuna tipologia configurata"
              description="Crea il primo corso per iniziare a programmare le lezioni."
            />
          ) : null}

          {!loading && courseTypes.length > 0 ? (
            <div className="courses-config-list">
              {courseTypes.map((courseType) => (
                <article key={courseType.id}>
                  <i style={{ background: courseType.color }} />
                  <div>
                    <strong>{courseType.name}</strong>
                    <span>
                      {courseType.default_duration_minutes} min ·{" "}
                      {courseType.default_capacity} posti
                    </span>
                  </div>
                  <BGStatusBadge
                    tone={courseType.is_active ? "success" : "neutral"}
                  >
                    {courseType.is_active ? "Attivo" : "Disattivato"}
                  </BGStatusBadge>
                </article>
              ))}
            </div>
          ) : null}
        </BGCard>

        <BGCard variant="premium">
          <div className="courses-setup-card-header">
            <div>
              <DoorOpen size={22} />
              <div>
                <span>Spazi operativi</span>
                <h3>Sale corsi</h3>
              </div>
            </div>

            {canManage ? (
              <BGButton
                variant={openRoomForm ? "ghost" : "secondary"}
                onClick={() => setOpenRoomForm(!openRoomForm)}
              >
                {openRoomForm ? <X size={16} /> : <Plus size={16} />}
                {openRoomForm ? "Chiudi" : "Nuova sala"}
              </BGButton>
            ) : null}
          </div>

          {openRoomForm ? (
            <div className="courses-form-panel">
              <div className="courses-form-grid courses-form-grid-room">
                <BGInput
                  label="Nome sala"
                  value={roomName}
                  onChange={(event) =>
                    setRoomName(event.target.value)
                  }
                  placeholder="Es. Sala Reformer"
                />

                <BGInput
                  label="Capienza"
                  type="number"
                  min="1"
                  max="1000"
                  value={roomCapacity}
                  onChange={(event) =>
                    setRoomCapacity(event.target.value)
                  }
                />
              </div>

              <label className="courses-textarea-field">
                <span>Descrizione</span>
                <textarea
                  value={roomDescription}
                  onChange={(event) =>
                    setRoomDescription(event.target.value)
                  }
                  placeholder="Descrizione interna della sala"
                  rows={3}
                />
              </label>

              <div className="courses-form-actions">
                <BGButton
                  onClick={() => void createRoom()}
                  disabled={savingRoom}
                >
                  <Plus size={17} />
                  {savingRoom ? "Creazione…" : "Crea sala"}
                </BGButton>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="courses-config-loading">
              Caricamento sale…
            </div>
          ) : null}

          {!loading && rooms.length === 0 ? (
            <BGEmptyState
              title="Nessuna sala configurata"
              description="Crea la prima sala da associare alle lezioni."
            />
          ) : null}

          {!loading && rooms.length > 0 ? (
            <div className="courses-config-list">
              {rooms.map((room) => (
                <article key={room.id}>
                  <div className="courses-room-icon">
                    <DoorOpen size={18} />
                  </div>
                  <div>
                    <strong>{room.name}</strong>
                    <span>{room.capacity} posti disponibili</span>
                  </div>
                  <BGStatusBadge
                    tone={room.is_active ? "success" : "neutral"}
                  >
                    {room.is_active ? "Attiva" : "Disattivata"}
                  </BGStatusBadge>
                </article>
              ))}
            </div>
          ) : null}
        </BGCard>
      </div>
    </section>
  );
}
