"use client";

import { BGButton, BGCard, BGEmptyState, BGPageHeader, BGPageShell, BGStatCard, BGStatusBadge } from "@/components/bodygate-ui";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Branch = {
  id: string;
  name: string | null;
  city?: string | null;
};

type SubscriptionPlan = {
  id: string;
  branch_id: string | null;
  name: string | null;
  price: number | string | null;
  promo_price: number | string | null;
  duration_days: number | string | null;
  sort_order: number | string | null;
  is_active: boolean | null;
};

type PlanForm = {
  name: string;
  price: string;
  promoPrice: string;
  durationDays: string;
  sortOrder: string;
  isActive: boolean;
};

type PresetPlan = {
  name: string;
  price: string;
  durationDays: string;
};

const EMPTY_FORM: PlanForm = {
  name: "",
  price: "",
  promoPrice: "",
  durationDays: "30",
  sortOrder: "1",
  isActive: true,
};

const BUSINESS_PRESETS: PresetPlan[] = [
  { name: "Mensile", price: "45", durationDays: "30" },
  { name: "Trimestrale", price: "120", durationDays: "90" },
  { name: "Semestrale", price: "200", durationDays: "180" },
  { name: "Annuale", price: "350", durationDays: "365" },
];

const ALL_BRANCHES_VALUE = "";

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function euro(value: number | string | null | undefined) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(toNumber(value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sortPlansByDisplayOrder(plans: SubscriptionPlan[]) {
  return [...plans].sort((firstPlan, secondPlan) => {
    const sortOrderDifference =
      toNumber(firstPlan.sort_order) - toNumber(secondPlan.sort_order);

    if (sortOrderDifference !== 0) return sortOrderDifference;

    return (firstPlan.name || "").localeCompare(secondPlan.name || "", "it", {
      sensitivity: "base",
    });
  });
}

function getUniquePlanBranchIds(plans: SubscriptionPlan[]) {
  return Array.from(
    new Set(
      plans
        .map((plan) => plan.branch_id)
        .filter((branchId): branchId is string => Boolean(branchId))
    )
  );
}

function planToForm(plan: SubscriptionPlan): PlanForm {
  return {
    name: plan.name || "",
    price: String(toNumber(plan.price) || ""),
    promoPrice: plan.promo_price === null ? "" : String(toNumber(plan.promo_price) || ""),
    durationDays: String(toNumber(plan.duration_days) || ""),
    sortOrder: String(toNumber(plan.sort_order) || ""),
    isActive: plan.is_active !== false,
  };
}

function validateForm(form: PlanForm) {
  const name = form.name.trim();
  const price = Number(form.price);
  const promoPrice = form.promoPrice.trim() ? Number(form.promoPrice) : null;
  const durationDays = Number(form.durationDays);
  const sortOrder = Number(form.sortOrder);

  if (!name) return "Inserisci il nome del piano.";
  if (!Number.isFinite(price) || price <= 0) return "Inserisci un prezzo valido maggiore di zero.";
  if (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice < 0)) {
    return "Inserisci un prezzo promo valido oppure lascia il campo vuoto.";
  }
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return "Inserisci una durata in giorni valida.";
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return "Inserisci un ordine di visualizzazione valido.";
  }

  return null;
}

export default function SubscriptionPlansPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [newPlan, setNewPlan] = useState<PlanForm>(EMPTY_FORM);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editForm, setEditForm] = useState<PlanForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadPlans(selectedBranchId);
  }, [selectedBranchId]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const kpis = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.is_active !== false);
    const inactivePlans = plans.filter((plan) => plan.is_active === false);
    const effectivePrices = plans.map((plan) =>
      toNumber(plan.promo_price || plan.price)
    );
    const durations = plans.map((plan) => toNumber(plan.duration_days));

    return {
      active: activePlans.length,
      inactive: inactivePlans.length,
      averagePrice: euro(average(effectivePrices)),
      averageDuration: `${Math.round(average(durations))} gg`,
    };
  }, [plans]);

  async function loadBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, city")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage("Impossibile caricare le sedi attive.");
      setBranches([]);
      return;
    }

    setBranches(data || []);
  }

  async function loadPlans(branchId = ALL_BRANCHES_VALUE) {
    setLoading(true);
    setErrorMessage("");

    let query = supabase
      .from("subscription_plans")
      .select("id, branch_id, name, price, promo_price, duration_days, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      setErrorMessage("Impossibile caricare i piani abbonamento.");
      setPlans([]);
    } else {
      const sortedPlans = sortPlansByDisplayOrder(data || []);
      setPlans(sortedPlans);
      setNewPlan((current) => ({
        ...current,
        sortOrder: String(sortedPlans.length + 1),
      }));

      if (!branchId) {
        const planBranchIds = getUniquePlanBranchIds(sortedPlans);

        if (planBranchIds.length === 1) {
          setSelectedBranchId((current) => current || planBranchIds[0]);
        }
      }
    }

    setLoading(false);
  }

  function applyPreset(preset: PresetPlan) {
    setNewPlan((current) => ({
      ...current,
      name: preset.name,
      price: preset.price,
      durationDays: preset.durationDays,
    }));
  }

  function updateNewPlan(field: keyof PlanForm, value: string | boolean) {
    setNewPlan((current) => ({ ...current, [field]: value }));
  }

  function updateEditPlan(field: keyof PlanForm, value: string | boolean) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setEditForm(planToForm(plan));
    setMessage("");
    setErrorMessage("");
  }

  function closeEditor() {
    setEditingPlan(null);
    setEditForm(EMPTY_FORM);
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!selectedBranchId) {
      setErrorMessage("Seleziona una sede prima di creare un piano.");
      return;
    }

    const validationError = validateForm(newPlan);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("subscription_plans").insert({
      branch_id: selectedBranchId,
      name: newPlan.name.trim(),
      price: Number(newPlan.price),
      promo_price: newPlan.promoPrice.trim() ? Number(newPlan.promoPrice) : null,
      duration_days: Number(newPlan.durationDays),
      sort_order: Number(newPlan.sortOrder),
      is_active: newPlan.isActive,
    });

    if (error) {
      setErrorMessage("Creazione piano non riuscita.");
    } else {
      setMessage("Piano abbonamento creato.");
      setNewPlan({
        ...EMPTY_FORM,
        sortOrder: String(plans.length + 2),
      });
      await loadPlans(selectedBranchId);
    }

    setSaving(false);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!editingPlan) return;

    const validationError = validateForm(editForm);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("subscription_plans")
      .update({
        name: editForm.name.trim(),
        price: Number(editForm.price),
        promo_price: editForm.promoPrice.trim()
          ? Number(editForm.promoPrice)
          : null,
        duration_days: Number(editForm.durationDays),
        sort_order: Number(editForm.sortOrder),
        is_active: editForm.isActive,
      })
      .eq("id", editingPlan.id);

    if (error) {
      setErrorMessage("Aggiornamento piano non riuscito.");
    } else {
      setMessage("Piano abbonamento aggiornato.");
      closeEditor();
      await loadPlans(selectedBranchId);
    }

    setSaving(false);
  }

  async function togglePlan(plan: SubscriptionPlan) {
    setMessage("");
    setErrorMessage("");
    setSaving(true);

    const nextActiveState = plan.is_active === false;
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: nextActiveState })
      .eq("id", plan.id);

    if (error) {
      setErrorMessage("Cambio stato non riuscito.");
    } else {
      setMessage(nextActiveState ? "Piano riattivato." : "Piano disattivato.");
      await loadPlans(selectedBranchId);
      if (editingPlan?.id === plan.id) {
        setEditingPlan((current) =>
          current ? { ...current, is_active: nextActiveState } : current
        );
        setEditForm((current) => ({ ...current, isActive: nextActiveState }));
      }
    }

    setSaving(false);
  }

  return (
    <div className="plans-page-v2">
      <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate · Abbonamenti"
        title="Piani Abbonamento"
        subtitle="Gestisci i piani usati dal rinnovo cliente. La quota associativa resta separata e non viene amministrata in questa sezione."
        actions={
          <div className="plans-header-actions">
            <BGStatusBadge tone={errorMessage ? "danger" : "info"}>
              {errorMessage ? "Attenzione" : "Solo piani"}
            </BGStatusBadge>
            <BGButton onClick={() => loadPlans(selectedBranchId)} variant="secondary">
              Aggiorna
            </BGButton>
          </div>
        }
      />

      <section className="plans-toolbar">
        <label className="field-label" htmlFor="branch">
          Sede operativa
        </label>
        <select
          id="branch"
          value={selectedBranchId}
          onChange={(event) => setSelectedBranchId(event.target.value)}
          className="plans-select"
          disabled={saving}
        >
          <option value={ALL_BRANCHES_VALUE}>Tutte le sedi</option>
          {selectedBranchId && !selectedBranch && (
            <option value={selectedBranchId}>Sede associata ai piani</option>
          )}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name || "Sede BodyGate"}{branch.city ? ` · ${branch.city}` : ""}
            </option>
          ))}
        </select>
      </section>

      {(message || errorMessage) && (
        <div className={`plans-alert ${errorMessage ? "danger" : "success"}`}>
          {errorMessage || message}
        </div>
      )}

      <section className="plans-kpi-grid">
        <BGStatCard label="Piani attivi" value={kpis.active} note="Disponibili per rinnovo" tone="green" />
        <BGStatCard label="Piani non attivi" value={kpis.inactive} note="Conservati nello storico" tone={kpis.inactive > 0 ? "yellow" : "neutral"} />
        <BGStatCard label="Prezzo medio" value={kpis.averagePrice} note="Calcolato sul prezzo promo se presente" tone="blue" />
        <BGStatCard label="Durata media" value={kpis.averageDuration} note="Media dei giorni configurati" />
      </section>

      <div className="plans-layout">
        <div className="plans-main-column">
          <BGCard>
            <div className="plans-card-head">
              <div>
                <h2>Piani configurati</h2>
                <p>
                  Ordinati per ordine visualizzazione e poi nome piano
                  {selectedBranch ? ` · ${selectedBranch.name || "Sede BodyGate"}` : " · tutte le sedi"}.
                </p>
              </div>
              {loading && <BGStatusBadge tone="warning">Caricamento</BGStatusBadge>}
            </div>

            {!loading && plans.length === 0 ? (
              <BGEmptyState
                title="Nessun piano abbonamento"
                description="Crea Mensile, Trimestrale, Semestrale o Annuale per renderli disponibili al rinnovo cliente."
              />
            ) : (
              <div className="plans-table-wrap" style={{ maxWidth: "100%", overflowX: "auto" }}>
                <table className="plans-table">
                  <thead>
                    <tr>
                      <th>Piano</th>
                      <th>Prezzo</th>
                      <th>Promo</th>
                      <th>Durata</th>
                      <th>Stato</th>
                      <th>Ordine</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className={plan.is_active === false ? "inactive" : ""}>
                        <td>
                          <div className="plan-name">{plan.name || "Piano senza nome"}</div>
                        </td>
                        <td>{euro(plan.price)}</td>
                        <td>
                          {plan.promo_price ? (
                            <span className="promo-price">{euro(plan.promo_price)}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{toNumber(plan.duration_days)} giorni</td>
                        <td>
                          <BGStatusBadge tone={plan.is_active === false ? "danger" : "success"}>
                            {plan.is_active === false ? "Non attivo" : "Attivo"}
                          </BGStatusBadge>
                        </td>
                        <td>
                          <span className="sort-pill">{toNumber(plan.sort_order)}</span>
                        </td>
                        <td>
                          <div className="plan-actions">
                            <BGButton onClick={() => startEditing(plan)} variant="ghost">
                              Modifica
                            </BGButton>
                            <BGButton
                              onClick={() => togglePlan(plan)}
                              variant={plan.is_active === false ? "secondary" : "danger"}
                              disabled={saving}
                            >
                              {plan.is_active === false ? "Riattiva" : "Disattiva"}
                            </BGButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BGCard>
        </div>

        <aside className="plans-side-column">
          <BGCard variant="soft">
            <div className="plans-card-head stacked">
              <div>
                <h2>Nuovo piano</h2>
                <p>La quota associativa non va inserita nei piani abbonamento.</p>
              </div>
            </div>

            <div className="preset-grid" aria-label="Preset piani BodyGate">
              {BUSINESS_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="preset-button"
                  onClick={() => applyPreset(preset)}
                >
                  <strong>{preset.name}</strong>
                  <span>{euro(preset.price)} · {preset.durationDays} gg</span>
                </button>
              ))}
            </div>

            <form className="plan-form" onSubmit={createPlan}>
              <PlanFields form={newPlan} onChange={updateNewPlan} />
              <BGButton type="submit" disabled={saving || !selectedBranchId}>
                Crea piano
              </BGButton>
            </form>
          </BGCard>

          {editingPlan && (
            <BGCard variant="warning">
              <div className="plans-card-head stacked">
                <div>
                  <h2>Modifica piano</h2>
                  <p>{editingPlan.name || "Piano selezionato"}</p>
                </div>
              </div>

              <form className="plan-form" onSubmit={savePlan}>
                <PlanFields form={editForm} onChange={updateEditPlan} />
                <div className="editor-actions">
                  <BGButton type="submit" disabled={saving}>
                    Salva modifiche
                  </BGButton>
                  <BGButton onClick={closeEditor} variant="ghost" disabled={saving}>
                    Annulla
                  </BGButton>
                </div>
              </form>
            </BGCard>
          )}
        </aside>
      </div>

      </BGPageShell>

      <style jsx>{`
        .plans-page-v2 {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          overflow-x: hidden;
          padding: 26px;
          color: #fff;
          background:
            radial-gradient(circle at top left, rgba(91, 61, 245, 0.24), transparent 30%),
            radial-gradient(circle at 78% 10%, rgba(255, 255, 255, 0.08), transparent 25%),
            linear-gradient(135deg, #050505, #090909 48%, #111);
        }

        .plans-header-actions,
        .plan-actions,
        .editor-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .plans-toolbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
          padding: 16px 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.045);
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: #9b9b9b;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .plans-select,
        .field-input,
        .field-checkbox {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          background: rgba(5, 5, 5, 0.78);
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          outline: none;
        }

        .plans-select,
        .field-input {
          min-height: 46px;
          padding: 12px 14px;
        }

        .field-checkbox {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 50px;
          padding: 12px 14px;
          color: #d6d6d6;
        }

        .field-checkbox input {
          width: 18px;
          height: 18px;
          accent-color: #5b3df5;
        }

        .plans-alert {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 900;
        }

        .plans-alert.success {
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.22);
          background: rgba(34, 197, 94, 0.08);
        }

        .plans-alert.danger {
          color: #fecaca;
          border: 1px solid rgba(91, 61, 245, 0.3);
          background: rgba(91, 61, 245, 0.1);
        }

        .plans-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .plans-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 18px;
          align-items: start;
        }

        .plans-main-column,
        .plans-side-column {
          min-width: 0;
        }

        .plans-side-column {
          display: grid;
          gap: 18px;
        }

        .plans-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 18px;
          margin-bottom: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .plans-card-head.stacked {
          display: block;
        }

        .plans-card-head h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
        }

        .plans-card-head p {
          margin: 8px 0 0;
          color: #9f9f9f;
          font-size: 13px;
          line-height: 1.5;
        }

        .plans-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .plans-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        .plans-table th,
        .plans-table td {
          padding: 14px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
          vertical-align: middle;
        }

        .plans-table th {
          color: #858585;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .plans-table td {
          color: #e7e7e7;
          font-size: 13px;
          font-weight: 800;
        }

        .plans-table tr.inactive td {
          color: #9a9a9a;
          background: rgba(255, 255, 255, 0.018);
        }

        .plan-name {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.02em;
          max-width: 280px;
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: 1.3;
        }

        .promo-price {
          color: #86efac;
          font-weight: 950;
        }

        .muted {
          color: #777;
        }

        .sort-pill {
          display: inline-flex;
          min-width: 38px;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          color: #d4d4d4;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.055);
        }

        .preset-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .preset-button {
          cursor: pointer;
          text-align: left;
          border: 1px solid rgba(91, 61, 245, 0.24);
          border-radius: 18px;
          padding: 13px;
          background: rgba(91, 61, 245, 0.075);
          color: #fff;
          min-width: 0;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .preset-button strong,
        .preset-button span {
          display: block;
        }

        .preset-button strong {
          font-size: 13px;
          font-weight: 950;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .preset-button span {
          margin-top: 6px;
          color: #bdbdbd;
          font-size: 12px;
          font-weight: 800;
        }

        .plan-form {
          display: grid;
          gap: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .form-field.full {
          grid-column: 1 / -1;
        }

        @media (max-width: 1180px) {
          .plans-layout {
            grid-template-columns: 1fr;
          }

          .plans-side-column {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .plans-page-v2 {
            padding: 0;
          }

          .plans-kpi-grid,
          .plans-side-column,
          .form-grid,
          .preset-grid {
            grid-template-columns: 1fr;
          }

          .plans-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .plans-table-wrap {
            box-sizing: border-box;
            width: calc(100% - 24px);
          }

          .plans-table {
            width: 900px;
          }
        }
      `}</style>
    </div>
  );
}

function PlanFields({
  form,
  onChange,
}: {
  form: PlanForm;
  onChange: (field: keyof PlanForm, value: string | boolean) => void;
}) {
  return (
    <div className="form-grid">
      <div className="form-field full">
        <label className="field-label" htmlFor="plan-name">
          Nome
        </label>
        <input
          id="plan-name"
          className="field-input"
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Es. Mensile"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="plan-price">
          Prezzo
        </label>
        <input
          id="plan-price"
          className="field-input"
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(event) => onChange("price", event.target.value)}
          placeholder="45"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="plan-promo-price">
          Prezzo promo
        </label>
        <input
          id="plan-promo-price"
          className="field-input"
          type="number"
          min="0"
          step="0.01"
          value={form.promoPrice}
          onChange={(event) => onChange("promoPrice", event.target.value)}
          placeholder="Opzionale"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="plan-duration">
          Durata giorni
        </label>
        <input
          id="plan-duration"
          className="field-input"
          type="number"
          min="1"
          step="1"
          value={form.durationDays}
          onChange={(event) => onChange("durationDays", event.target.value)}
          placeholder="30"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="plan-sort-order">
          Ordine
        </label>
        <input
          id="plan-sort-order"
          className="field-input"
          type="number"
          min="0"
          step="1"
          value={form.sortOrder}
          onChange={(event) => onChange("sortOrder", event.target.value)}
          placeholder="1"
        />
      </div>

      <div className="form-field full">
        <label className="field-checkbox" htmlFor="plan-active">
          <span>Attivo per rinnovo cliente</span>
          <input
            id="plan-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => onChange("isActive", event.target.checked)}
          />
        </label>
      </div>
    </div>
  );
}
