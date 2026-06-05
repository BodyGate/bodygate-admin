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

    const { data, error } = await supabase
      .from("customer_access_logs")
      .select(
        `
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
      `,
      )
      .order("access_time", { ascending: false })
      .limit(50);

    if (error) {
      setLogs([]);
      setErrorMessage(error.message || "Errore caricamento access logs.");
      setLoading(false);
      return;
    }

    setLogs((data || []) as unknown as AccessLog[]);
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
            <th>Data/Ora</th>
            <th>Stato</th>
            <th>Cliente</th>
            <th>Badge</th>
            <th>Controller</th>
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
                <td className="bg-table-strong">
                  {formatDate(log.access_time)}
                </td>

                <td>
                  <BGStatusBadge tone={log.was_allowed ? "success" : "danger"}>
                    {log.was_allowed ? "Consentito" : "Negato"}
                  </BGStatusBadge>
                </td>

                <td className="bg-table-strong">{getCustomerName(log)}</td>

                <td className="bg-table-code">{log.badge_code || "—"}</td>

                <td className="bg-table-code">{log.controller_code || "—"}</td>

                <td className="bg-table-muted">
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
