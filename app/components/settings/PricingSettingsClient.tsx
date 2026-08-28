"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  promo_price: number | null;
  category: string | null;
  duration_days: number;
  color: string;
  is_active: boolean;
};

type TrainingService = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  duration_days: number | null;
  trainer_name: string | null;
  color: string;
  is_active: boolean;
};

export default function PricingSettingsClient() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [services, setServices] = useState<TrainingService[]>([]);

  async function loadData() {
    const { data: plansData } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order");

    const { data: servicesData } = await supabase
      .from("training_services")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    setPlans(plansData || []);
    setServices(servicesData || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>
            BodyGate Commercial
          </p>

          <h1 style={styles.title}>
            Pricing Management
          </h1>

          <p style={styles.subtitle}>
            Configura abbonamenti e servizi
            training della piattaforma.
          </p>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Abbonamenti
        </h2>

        <div style={styles.grid}>
          {plans.map((plan) => (
            <article
              key={plan.id}
              style={{
                ...styles.card,
                borderColor: plan.color,
              }}
            >
              <div>
                <div style={styles.cardTitle}>
                  {plan.name}
                </div>

                <div style={styles.cardCategory}>
                  {plan.category || "Standard"}
                </div>
              </div>

              <div style={styles.price}>
                € {plan.price}
              </div>

              <div style={styles.meta}>
                {plan.duration_days} giorni
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Training Services
        </h2>

        <div style={styles.grid}>
          {services.map((service) => (
            <article
              key={service.id}
              style={{
                ...styles.card,
                borderColor: service.color,
              }}
            >
              <div>
                <div style={styles.cardTitle}>
                  {service.name}
                </div>

                <div style={styles.cardCategory}>
                  {service.category || "Training"}
                </div>
              </div>

              <div style={styles.price}>
                € {service.price}
              </div>

              <div style={styles.meta}>
                {service.trainer_name ||
                  "Nessun trainer"}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "var(--text)",
  },

  hero: {
    padding: 28,
    borderRadius: 28,
    marginBottom: 28,

    background:
      "linear-gradient(178deg, rgba(31,157,107,0.08), var(--panel) 55%)",

    border: "1px solid var(--border)",
  },

  eyebrow: {
    color: "#157a53",
    textTransform: "uppercase",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },

  title: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
    color: "var(--text)",
  },

  subtitle: {
    color: "var(--muted)",
    maxWidth: 700,
  },

  section: {
    marginBottom: 34,
  },

  sectionTitle: {
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 20,
    color: "var(--text)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: 18,
  },

  card: {
    padding: 24,
    borderRadius: 24,

    background: "var(--panel)",

    border: "2px solid",
    boxShadow: "0 1px 2px rgba(21,22,28,0.04), 0 12px 32px -12px rgba(21,22,28,0.1)",

    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text)",
  },

  cardCategory: {
    color: "var(--muted)",
    marginTop: 6,
  },

  price: {
    fontSize: 32,
    fontWeight: 900,
    color: "var(--text)",
  },

  meta: {
    color: "var(--muted)",
  },
};