"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/**
 * Aggiornamenti "live" senza esporre dati.
 *
 * Il database invia sul canale broadcast `bodygate-live` un segnale
 * `{ table }` a ogni modifica delle tabelle monitorate (trigger
 * `bodygate_notify_change`, migrazione 20261108130000). Il segnale NON contiene
 * righe ne' dati personali: i client lo usano solo come "ricarica" e rileggono
 * i dati dalle API autenticate. Per questo la chiave anon non ha piu' bisogno
 * di alcun accesso diretto alle tabelle.
 *
 * Una sola connessione condivisa per tutta l'app (ref-count).
 */

const TOPIC = "bodygate-live";
const EVENT = "change";

type Listener = (table: string) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function ensureChannel() {
  if (channel) return;

  channel = supabase
    .channel(TOPIC, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: EVENT }, ({ payload }) => {
      const table =
        payload && typeof payload.table === "string" ? payload.table : "";
      listeners.forEach((listener) => listener(table));
    })
    .subscribe();
}

function releaseChannel() {
  if (listeners.size > 0 || !channel) return;
  void supabase.removeChannel(channel);
  channel = null;
}

/**
 * Chiama `onChange` (con debounce) quando cambia una delle `tables`.
 * Ritorna la funzione per annullare la sottoscrizione.
 */
export function subscribeLiveChanges(
  tables: readonly string[],
  onChange: () => void,
  debounceMs = 400,
) {
  const watched = new Set(tables);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const listener: Listener = (table) => {
    if (watched.size > 0 && !watched.has(table)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  listeners.add(listener);
  ensureChannel();

  return () => {
    if (timer) clearTimeout(timer);
    listeners.delete(listener);
    releaseChannel();
  };
}

export function useLiveChanges(
  tables: readonly string[],
  onChange: () => void,
  debounceMs = 400,
) {
  const onChangeRef = useRef(onChange);
  const tablesKey = tables.join(",");

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    return subscribeLiveChanges(
      tablesKey ? tablesKey.split(",") : [],
      () => onChangeRef.current(),
      debounceMs,
    );
  }, [tablesKey, debounceMs]);
}
