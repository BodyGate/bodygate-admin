"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import StatusBadge from "./StatusBadge";

type AccessLog = {
  id: string;
  access_time: string | null;
  customer_id: string | null;
  branch_id: string | null;
  was_allowed: boolean;
  reason: string | null;
  badge_code: string | null;
  controller_code: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export default function AccessLogsTable() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_access_logs")
      .select(`
        id,
        access_time,
        customer_id,
        branch_id,
        was_allowed,
        reason,
        badge_code,
        controller_code,
        customers (
          first_name,
          last_name
        )
      `)
      .order("access_time", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Errore caricamento access logs:", error);
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs((data || []) as AccessLog[]);
    setLoading(false);
  }

  function getCustomerName(log: AccessLog) {
    const firstName = log.customers?.first_name || "";
    const lastName = log.customers?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || "-";
  }

  function formatDate(date: string | null) {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleString("it-IT");
    } catch {
      return "-";
    }
  }

  useEffect(() => {
    loadLogs();

    const channel = supabase
      .channel("customer_access_logs_live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_access_logs",
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--muted-text)]">
        Caricamento accessi...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">
            Registro accessi live
          </h2>

          <p className="mt-1 text-sm text-[var(--muted-text)]">
            Ultimi 50 eventi reali ricevuti dal tornello
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Aggiorna
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--muted-text)]">
            <tr>
              <th className="px-5 py-4">Data/Ora</th>
              <th className="px-5 py-4">Stato</th>
              <th className="px-5 py-4">Cliente</th>
              <th className="px-5 py-4">Badge</th>
              <th className="px-5 py-4">Controller</th>
              <th className="px-5 py-4">Motivo</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-[var(--muted-text)]"
                >
                  Nessun accesso registrato.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-[var(--border)] transition hover:bg-[var(--soft)]"
                >
                  <td className="px-5 py-4 text-[var(--text)]">
                    {formatDate(log.access_time)}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge
                      allowed={log.was_allowed}
                      reason={log.reason}
                    />
                  </td>

                  <td className="px-5 py-4 font-semibold text-[var(--text)]">
                    {getCustomerName(log)}
                  </td>

                  <td className="px-5 py-4 font-mono text-[var(--text)]">
                    {log.badge_code || "-"}
                  </td>

                  <td className="px-5 py-4 font-mono text-[var(--text)]">
                    {log.controller_code || "-"}
                  </td>

                  <td className="px-5 py-4 text-[var(--muted-text)]">
                    {log.reason || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}