"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./training-premium.module.css";

type Customer = { id: string; first_name: string | null; last_name: string | null; email?: string | null; phone?: string | null; is_active?: boolean | null };
type Program = { id: string; customer_id: string | null; title: string; goal: string | null; coach_name: string | null; is_active: boolean | null; created_at: string; customers?: { first_name: string | null; last_name: string | null } | null };
type Exercise = { id: string; name: string; muscle_group: string | null; equipment: string | null; difficulty: string | null; machine_brand?: string | null; machine_name?: string | null; machine_code?: string | null; is_active?: boolean | null };
type Session = { id: string; status: string | null; started_at: string | null; completed_at: string | null; created_at: string | null };
type TrainingData = { customers: Customer[]; programs: Program[]; exercises: Exercise[]; sessions: Session[] };
type View = "dashboard" | "clients" | "programs" | "library" | "exercise" | "sessions" | "builder";

type Props = { view: View; programId?: string; exerciseId?: string };

const emptyData: TrainingData = { customers: [], programs: [], exercises: [], sessions: [] };

function fullName(customer?: Customer | Program["customers"] | null) {
  return `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Cliente non assegnato";
}

async function trainingRequest(payload?: Record<string, unknown>) {
  const response = await fetch("/api/training", payload ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : undefined);
  const result = (await response.json()) as { ok: boolean; data?: TrainingData; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Operazione Training fallita");
  return result;
}

export default function TrainingPremiumClient({ view, programId, exerciseId }: Props) {
  const [data, setData] = useState<TrainingData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await trainingRequest();
      setData((result.data as TrainingData) || emptyData);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Errore caricamento Training");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const activePrograms = data.programs.filter((program) => program.is_active !== false);
  const activeExercises = data.exercises.filter((exercise) => exercise.is_active !== false);
  const filteredExercises = useMemo(() => data.exercises.filter((exercise) => `${exercise.name} ${exercise.muscle_group || ""} ${exercise.equipment || ""}`.toLowerCase().includes(search.toLowerCase())), [data.exercises, search]);
  const selectedProgram = data.programs.find((program) => program.id === programId);
  const selectedExercise = data.exercises.find((exercise) => exercise.id === exerciseId) || filteredExercises[0];

  async function toggle(table: "training_programs" | "exercises", id: string, isActive: boolean) {
    try { await trainingRequest({ action: "toggle", table, id, is_active: isActive }); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : "Toggle fallito"); }
  }

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div><p className={styles.kicker}>BodyGate Premium Training</p><h1>Training rebuild</h1><p>Modulo unico Platinum: dashboard, atleti, programmi atomici, builder, catalogo esercizi canonico e sessioni.</p></div>
      <div className={styles.heroCard}><strong>{activePrograms.length}</strong><span>programmi attivi</span></div>
    </section>
    {notice && <div className={styles.notice}>{notice}</div>}
    {loading ? <div className={styles.panel}>Caricamento dati server...</div> : null}
    {view === "dashboard" && <Dashboard data={data} activeExercises={activeExercises.length} />}
    {view === "clients" && <Clients customers={data.customers} programs={data.programs} />}
    {view === "programs" && <Programs customers={data.customers} programs={data.programs} onReload={load} onNotice={setNotice} onToggle={toggle} />}
    {view === "builder" && <Builder program={selectedProgram} exercises={activeExercises} />}
    {view === "library" && <Library exercises={filteredExercises} search={search} setSearch={setSearch} onReload={load} onNotice={setNotice} onToggle={toggle} />}
    {view === "exercise" && <ExerciseDetail exercise={selectedExercise} />}
    {view === "sessions" && <Sessions sessions={data.sessions} />}
  </main>;
}

function Dashboard({ data, activeExercises }: { data: TrainingData; activeExercises: number }) {
  const cards = [{ label: "Atleti", value: data.customers.length }, { label: "Programmi", value: data.programs.length }, { label: "Esercizi canonici", value: activeExercises }, { label: "Sessioni", value: data.sessions.length }];
  return <section className={styles.grid}>{cards.map((card) => <article className={styles.card} key={card.label}><span>{card.label}</span><strong>{card.value}</strong></article>)}</section>;
}

function Clients({ customers, programs }: { customers: Customer[]; programs: Program[] }) {
  return <section className={styles.panel}><h2>Clienti / Atleti</h2><div className={styles.list}>{customers.map((customer) => <div className={styles.row} key={customer.id}><div><strong>{fullName(customer)}</strong><span>{customer.email || customer.phone || "Profilo atleta"}</span></div><b>{programs.filter((program) => program.customer_id === customer.id).length} programmi</b></div>)}</div></section>;
}

function Programs({ customers, programs, onReload, onNotice, onToggle }: { customers: Customer[]; programs: Program[]; onReload: () => Promise<void>; onNotice: (value: string | null) => void; onToggle: (table: "training_programs", id: string, isActive: boolean) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await trainingRequest({ action: "create-program", payload: { customer_id: form.get("customer_id"), title: form.get("title"), goal: form.get("goal"), days: [] } });
      event.currentTarget.reset(); await onReload();
    } catch (error) { onNotice(error instanceof Error ? error.message : "Creazione atomica fallita"); }
  }
  return <section className={styles.twoCols}><form className={styles.panel} onSubmit={submit}><h2>Nuovo programma atomico</h2><select name="customer_id" required><option value="">Seleziona atleta</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{fullName(customer)}</option>)}</select><input name="title" required placeholder="Titolo programma" /><input name="goal" placeholder="Obiettivo" /><button>Creazione via RPC atomica</button></form><div className={styles.panel}><h2>Programmi</h2>{programs.map((program) => <div className={styles.row} key={program.id}><div><Link href={`/training/programs/${program.id}`}>{program.title}</Link><span>{fullName(program.customers)} · {program.goal || "Obiettivo libero"}</span></div><button type="button" onClick={() => onToggle("training_programs", program.id, program.is_active === false)}>{program.is_active === false ? "Attiva" : "Sospendi"}</button></div>)}</div></section>;
}

function Builder({ program, exercises }: { program?: Program; exercises: Exercise[] }) {
  return <section className={styles.panel}><h2>Builder programma</h2><p>{program ? `${program.title} · ${fullName(program.customers)}` : "Programma non trovato"}</p><div className={styles.grid}>{exercises.slice(0, 9).map((exercise) => <article className={styles.card} key={exercise.id}><strong>{exercise.name}</strong><span>{exercise.muscle_group || "Full body"}</span></article>)}</div></section>;
}

function Library({ exercises, search, setSearch, onReload, onNotice, onToggle }: { exercises: Exercise[]; search: string; setSearch: (value: string) => void; onReload: () => Promise<void>; onNotice: (value: string | null) => void; onToggle: (table: "exercises", id: string, isActive: boolean) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await trainingRequest({ action: "save-exercise", payload: { name: form.get("name"), muscle_group: form.get("muscle_group"), equipment: form.get("equipment"), difficulty: form.get("difficulty"), is_active: true } }); event.currentTarget.reset(); await onReload(); } catch (error) { onNotice(error instanceof Error ? error.message : "Salvataggio esercizio fallito"); } }
  return <section className={styles.twoCols}><form className={styles.panel} onSubmit={submit}><h2>Catalogo exercises</h2><input name="name" required placeholder="Nome esercizio" /><input name="muscle_group" placeholder="Gruppo muscolare" /><input name="equipment" placeholder="Attrezzatura" /><select name="difficulty"><option>base</option><option>intermedio</option><option>avanzato</option></select><button>Salva esercizio</button></form><div className={styles.panel}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nel catalogo" />{exercises.map((exercise) => <div className={styles.row} key={exercise.id}><div><Link href={`/training/library/${exercise.id}`}>{exercise.name}</Link><span>{exercise.muscle_group || "No gruppo"} · {exercise.equipment || "No attrezzo"}</span></div><button type="button" onClick={() => onToggle("exercises", exercise.id, exercise.is_active === false)}>{exercise.is_active === false ? "Attiva" : "Archivia"}</button></div>)}</div></section>;
}

function ExerciseDetail({ exercise }: { exercise?: Exercise }) { return <section className={styles.panel}><h2>Dettaglio esercizio</h2>{exercise ? <div className={styles.detail}><strong>{exercise.name}</strong><span>{exercise.muscle_group || "Gruppo da definire"}</span><span>{exercise.machine_brand || "BodyGate"} {exercise.machine_name || "Premium"}</span><p>{exercise.machine_code || "QR macchina e video vengono collegati al record canonico exercises."}</p></div> : <p>Nessun esercizio trovato.</p>}</section>; }
function Sessions({ sessions }: { sessions: Session[] }) { return <section className={styles.panel}><h2>Sessioni workout</h2>{sessions.map((session) => <div className={styles.row} key={session.id}><strong>{session.status || "programmata"}</strong><span>{session.started_at || session.created_at || "data non impostata"}</span></div>)}</section>; }
