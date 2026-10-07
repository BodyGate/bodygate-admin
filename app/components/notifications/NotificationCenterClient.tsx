"use client";

import { useEffect, useMemo, useState } from "react";
import { BGButton, BGEmptyState, BGPageHeader, BGStack } from "@/components/bodygate-ui";
import { supabase } from "../../lib/supabaseClient";
import NotificationCard from "./NotificationCard";
import NotificationFilters from "./NotificationFilters";
import NotificationStats from "./NotificationStats";

export type NotificationSeverity = "critical" | "warning" | "info";

export type BodyGateNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  customerName?: string;
  createdAt?: string;
};

export default function NotificationCenterClient() {
  const [notifications, setNotifications] = useState<BodyGateNotification[]>([]);
  const [filter, setFilter] = useState<"all" | NotificationSeverity>("all");
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);

    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const generated: BodyGateNotification[] = [];

    const response = await fetch("/api/notifications/feed", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      console.error("Errore caricamento notifiche:", result?.error);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const {
      customers,
      subscriptions,
      membershipFees,
      blocks,
      unknownBadges,
    } = result;

    customers?.forEach((customer: any) => {
      const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

      if (customer.medical_certificate_end) {
        const expiry = new Date(customer.medical_certificate_end);

        if (expiry < today) {
          generated.push({
            id: `medical-expired-${customer.id}`,
            type: "medical",
            title: "Certificato medico scaduto",
            message: `Il certificato medico di ${name} è scaduto.`,
            severity: "critical",
            customerName: name,
          });
        } else if (expiry <= in30Days) {
          generated.push({
            id: `medical-warning-${customer.id}`,
            type: "medical",
            title: "Certificato medico in scadenza",
            message: `Il certificato medico di ${name} scade entro 30 giorni.`,
            severity: "warning",
            customerName: name,
          });
        }
      }
    });

    subscriptions?.forEach((sub: any) => {
      if (!sub.ends_at) return;

      const name = `${sub.customers?.first_name || ""} ${sub.customers?.last_name || ""}`.trim();
      const expiry = new Date(sub.ends_at);

      if (expiry < today) {
        generated.push({
          id: `sub-expired-${sub.id}`,
          type: "subscription",
          title: "Abbonamento scaduto",
          message: `L'abbonamento di ${name} è scaduto.`,
          severity: "critical",
          customerName: name,
        });
      } else if (expiry <= in7Days) {
        generated.push({
          id: `sub-warning-${sub.id}`,
          type: "subscription",
          title: "Abbonamento in scadenza",
          message: `L'abbonamento di ${name} scade entro 7 giorni.`,
          severity: "warning",
          customerName: name,
        });
      }
    });

    membershipFees?.forEach((fee: any) => {
      if (!fee.valid_until) return;

      const name = `${fee.customers?.first_name || ""} ${fee.customers?.last_name || ""}`.trim();
      const expiry = new Date(fee.valid_until);

      if (expiry < today) {
        generated.push({
          id: `fee-expired-${fee.id}`,
          type: "membership",
          title: "Quota associativa scaduta",
          message: `La quota associativa di ${name} è scaduta.`,
          severity: "critical",
          customerName: name,
        });
      }
    });

    blocks?.forEach((block: any) => {
      const name = `${block.customers?.first_name || ""} ${block.customers?.last_name || ""}`.trim();

      generated.push({
        id: `block-${block.id}`,
        type: "block",
        title: "Cliente bloccato",
        message: `${name} ha un blocco attivo: ${block.reason || "Nessuna motivazione specificata"}.`,
        severity: "critical",
        customerName: name,
      });
    });

    unknownBadges?.forEach((badge: any) => {
      generated.push({
        id: `unknown-${badge.id}`,
        type: "unknown_badge",
        title: "Badge sconosciuto",
        message: `Tentativo di accesso con badge non riconosciuto: ${badge.badge_code || badge.controller_code || "N/D"}.`,
        severity: "info",
        createdAt: badge.created_at,
      });
    });

    setNotifications(generated);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("notification-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_access_logs" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_subscriptions" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_membership_fees" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_blocks" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "unknown_badge_logs" }, loadNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((item) => item.severity === filter);
  }, [notifications, filter]);

  return (
    <>
      <BGPageHeader
        eyebrow="BodyGate Intelligence"
        title="Notification Center"
        subtitle="Monitoraggio intelligente di scadenze, blocchi, badge sconosciuti e criticità operative."
        actions={
          <BGButton variant="secondary" onClick={loadNotifications}>
            Aggiorna
          </BGButton>
        }
      />

      <NotificationStats notifications={notifications} />

      <NotificationFilters activeFilter={filter} onChange={setFilter} />

      {loading ? (
        <BGEmptyState title="Caricamento notifiche..." />
      ) : filteredNotifications.length === 0 ? (
        <BGEmptyState title="Nessuna notifica trovata." />
      ) : (
        <BGStack>
          {filteredNotifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </BGStack>
      )}
    </>
  );
}
