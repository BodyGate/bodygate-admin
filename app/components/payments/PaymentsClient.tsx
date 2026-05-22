"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
  method_key: string;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  promo_price: number | null;
  duration_days: number | null;
  is_active: boolean | null;
};

type TrainingService = {
  id: string;
  name: string;
  price: number;
  duration_days: number | null;
  is_active: boolean | null;
};

type Payment = {
  id: string;
  amount: number;
  payment_type: string;
  description: string | null;
  status: string | null;
  paid_at: string;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  payment_methods?: {
    name: string | null;
  } | null;
};

export default function PaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [services, setServices] = useState<TrainingService[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [paymentType, setPaymentType] = useState("subscription");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function loadData() {
    setLoading(true);

    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        *,
        customers (
          first_name,
          last_name
        ),
        payment_methods (
          name
        )
      `)
      .order("paid_at", { ascending: false })
      .limit(100);

    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .order("last_name");

    const { data: methodsData } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("is_active", true)
      .order("name");

    const { data: plansData } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    const { data: servicesData } = await supabase
      .from("training_services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    setPayments(paymentsData || []);
    setCustomers(customersData || []);
    setMethods(methodsData || []);
    setPlans(plansData || []);
    setServices(servicesData || []);

    if (!methodId && methodsData && methodsData.length > 0) {
      setMethodId(methodsData[0].id);
    }

    setLoading(false);
  }

  function applySubscriptionPlan(planId: string) {
    setSelectedPlanId(planId);

    const plan = plans.find((item) => item.id === planId);

    if (!plan) return;

    const finalPrice = Number(plan.promo_price || plan.price || 0);

    setAmount(String(finalPrice));
    setDescription(`Abbonamento ${plan.name}`);
  }

  function applyTrainingService(serviceId: string) {
    setSelectedServiceId(serviceId);

    const service = services.find((item) => item.id === serviceId);

    if (!service) return;

    setAmount(String(Number(service.price || 0)));
    setDescription(`Servizio training ${service.name}`);
  }

  function handlePaymentTypeChange(value: string) {
    setPaymentType(value);
    setSelectedPlanId("");
    setSelectedServiceId("");
    setAmount("");
    setDescription("");

    if (value === "membership_fee") {
      setAmount("10");
      setDescription("Quota associativa annuale");
    }
  }

  async function createPayment(e: React.FormEvent) {
    e.preventDefault();

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      alert("Importo non valido.");
      return;
    }

    setSaving(true);

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId || null,
        payment_method_id: methodId || null,
        amount: numericAmount,
        payment_type: paymentType,
        description: description || null,
        status: "paid",
        paid_at: new Date().toISOString(),
        created_by: "admin@bodygate.it",
      })
      .select("id")
      .single();

    if (error) {
      alert("Errore durante il salvataggio del pagamento.");
      setSaving(false);
      return;
    }

    await supabase.from("cash_movements").insert({
      movement_type: "income",
      amount: numericAmount,
      category: paymentType,
      description: description || "Incasso registrato",
      payment_id: payment?.id || null,
      created_by: "admin@bodygate.it",
      movement_at: new Date().toISOString(),
    });

    setCustomerId("");
    setPaymentType("subscription");
    setSelectedPlanId("");
    setSelectedServiceId("");
    setAmount("");
    setDescription("");

    await loadData();
    setSaving(false);
  }

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`payments-live-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const todayTotal = useMemo(() => {
    const today = new Date().toDateString();

    return payments
      .filter((payment) => new Date(payment.paid_at).toDateString() === today)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const monthTotal = useMemo(() => {
    const now = new Date();

    return payments
      .filter((payment) => {
        const date = new Date(payment.paid_at);

        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>BodyGate Financial</p>
          <h1 style={styles.title}>Pagamenti</h1>
          <p style={styles.subtitle}>
            Incassi, rinnovi, servizi training e prima nota automatica.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Incassi oggi</p>
          <strong style={styles.statValue}>€ {todayTotal.toFixed(2)}</strong>
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Incassi mese</p>
          <strong style={styles.statValue}>€ {monthTotal.toFixed(2)}</strong>
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Operazioni</p>
          <strong style={styles.statValue}>{payments.length}</strong>
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>Stato cassa</p>
          <strong style={styles.statValue}>Attiva</strong>
        </div>
      </section>

      <section style={styles.formPanel}>
        <h2 style={styles.panelTitle}>Nuovo incasso</h2>

        <form onSubmit={createPayment} style={styles.formGrid}>
          <label style={styles.label}>
            Cliente
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={styles.input}
            >
              <option value="">Nessun cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.last_name || ""} ${customer.first_name || ""}`.trim()}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Metodo pagamento
            <select
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              style={styles.input}
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Tipo incasso
            <select
              value={paymentType}
              onChange={(e) => handlePaymentTypeChange(e.target.value)}
              style={styles.input}
            >
              <option value="subscription">Abbonamento</option>
              <option value="membership_fee">Quota associativa</option>
              <option value="training">Training</option>
              <option value="product">Prodotto</option>
              <option value="other">Altro</option>
            </select>
          </label>

          {paymentType === "subscription" && (
            <label style={styles.label}>
              Piano abbonamento
              <select
                value={selectedPlanId}
                onChange={(e) => applySubscriptionPlan(e.target.value)}
                style={styles.input}
              >
                <option value="">Seleziona piano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — € {Number(plan.promo_price || plan.price).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {paymentType === "training" && (
            <label style={styles.label}>
              Servizio training
              <select
                value={selectedServiceId}
                onChange={(e) => applyTrainingService(e.target.value)}
                style={styles.input}
              >
                <option value="">Seleziona servizio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — € {Number(service.price).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={styles.label}>
            Importo automatico
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={styles.input}
              type="number"
              step="0.01"
              placeholder="0.00"
              readOnly={
                paymentType === "subscription" ||
                paymentType === "training" ||
                paymentType === "membership_fee"
              }
            />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Descrizione
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.input}
              placeholder="Descrizione incasso"
            />
          </label>

          <button disabled={saving} style={styles.saveButton}>
            {saving ? "Salvataggio..." : "Registra incasso"}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Storico pagamenti</h2>
            <p style={styles.panelSubtitle}>Ultime 100 operazioni registrate.</p>
          </div>

          <button onClick={loadData} style={styles.refreshButton}>
            Aggiorna
          </button>
        </div>

        {loading ? (
          <div style={styles.empty}>Caricamento pagamenti...</div>
        ) : payments.length === 0 ? (
          <div style={styles.empty}>Nessun pagamento registrato.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Metodo</th>
                  <th style={styles.th}>Descrizione</th>
                  <th style={styles.th}>Importo</th>
                  <th style={styles.th}>Stato</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => {
                  const customerName = `${payment.customers?.first_name || ""} ${
                    payment.customers?.last_name || ""
                  }`.trim();

                  return (
                    <tr key={payment.id}>
                      <td style={styles.td}>
                        {new Date(payment.paid_at).toLocaleString("it-IT")}
                      </td>

                      <td style={styles.td}>{customerName || "N/D"}</td>

                      <td style={styles.td}>{payment.payment_type || "N/D"}</td>

                      <td style={styles.td}>
                        {payment.payment_methods?.name || "N/D"}
                      </td>

                      <td style={styles.td}>{payment.description || "-"}</td>

                      <td style={styles.amount}>
                        € {Number(payment.amount || 0).toFixed(2)}
                      </td>

                      <td style={styles.td}>
                        <span style={styles.statusBadge}>
                          {payment.status || "paid"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "#fff",
  },
  hero: {
    padding: 28,
    borderRadius: 28,
    marginBottom: 24,
    background:
      "linear-gradient(135deg, rgba(34,197,94,0.20), rgba(15,23,42,0.96) 45%, rgba(2,6,23,1))",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  eyebrow: {
    color: "#4ade80",
    textTransform: "uppercase",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },
  title: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
  },
  subtitle: {
    color: "#94a3b8",
    maxWidth: 760,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    padding: 22,
    borderRadius: 24,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  statLabel: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  statValue: {
    display: "block",
    marginTop: 10,
    fontSize: 30,
    fontWeight: 900,
  },
  formPanel: {
    padding: 24,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 24,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginTop: 18,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    padding: "13px 14px",
    borderRadius: 14,
    outline: "none",
  },
  saveButton: {
    alignSelf: "end",
    border: "none",
    background: "#22c55e",
    color: "#04130a",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  panel: {
    padding: 24,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
  },
  panelSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },
  refreshButton: {
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.16)",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  empty: {
    color: "#94a3b8",
    padding: 20,
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: 16,
    color: "#94a3b8",
    fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  td: {
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    color: "#cbd5e1",
    fontSize: 14,
  },
  amount: {
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    color: "#4ade80",
    fontWeight: 900,
    fontSize: 15,
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.16)",
    color: "#86efac",
    fontSize: 12,
    fontWeight: 800,
  },
};