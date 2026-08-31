"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import BGActionButton from "./ui/BGActionButton";
import BGCard from "./ui/BGCard";
import BGDataTable from "./ui/BGDataTable";
import BGEmptyState from "./ui/BGEmptyState";
import BGSectionHeader from "./ui/BGSectionHeader";
import BGStatusBadge from "./ui/BGStatusBadge";

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
  const [errorMessage, setErrorMessage] = useState("");

  async function loadLogs() {
    setLoading(true);

    setErrorMessage("");

    const response = await fetch("/api/access/logs-feed", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setLogs([]);
      setErrorMessage(result?.error || "Errore caricamento access logs.");
      setLoading(false);
      return;
    }

    setLogs((result.logs || []) as unknown as AccessLog[]);
    setLoading(false);
  }

  function getCustomerName(log: AccessLog) {
    const firstName = log.customers?.first_name || "";
    const lastName = log.customers?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || "Cliente non associato";
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
    void Promise.resolve().then(loadLogs);

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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <BGCard className="bg-access-card">
        <BGEmptyState
          title="Caricamento accessi..."
          description="Sincronizzazione con gli ultimi eventi del tornello."
        />
      </BGCard>
    );
  }

  return (
    <BGCard className="bg-access-card">
      <BGSectionHeader
        title="Registro accessi live"
        subtitle="Ultimi 50 eventi reali ricevuti dal tornello, con stato e motivo separati per lettura immediata."
        actions={<BGActionButton onClick={loadLogs}>Aggiorna</BGActionButton>}
      />

      {errorMessage && <div className="bg-inline-message">{errorMessage}</div>}

      <BGDataTable minWidth={1080}>
        <thead>
          <tr>
            <th className="bg-table-nowrap">Data/Ora</th>
            <th className="bg-table-align-center">Stato</th>
            <th>Cliente</th>
            <th className="bg-table-nowrap">Badge</th>
            <th className="bg-table-nowrap">Controller</th>
            <th>Motivo</th>
          </tr>
        </thead>

        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <BGEmptyState
                  title="Nessun accesso registrato"
                  description="Gli eventi compariranno qui appena ricevuti dal tornello."
                />
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td className="bg-table-strong bg-table-nowrap">
                  {formatDate(log.access_time)}
                </td>

                <td className="bg-table-align-center">
                  <BGStatusBadge tone={log.was_allowed ? "success" : "danger"}>
                    {log.was_allowed ? "Consentito" : "Negato"}
                  </BGStatusBadge>
                </td>

                <td className="bg-table-strong">{getCustomerName(log)}</td>

                <td className="bg-table-code bg-table-nowrap">{log.badge_code || "—"}</td>

                <td className="bg-table-code bg-table-nowrap">{log.controller_code || "—"}</td>

                <td className="bg-table-muted bg-table-reason">
                  {log.reason || "Nessun motivo registrato"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </BGDataTable>
    </BGCard>
  );
}
