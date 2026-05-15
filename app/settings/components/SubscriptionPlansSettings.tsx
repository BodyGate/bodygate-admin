"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Category = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  is_active: boolean;
  category_id: string | null;
};

export default function SubscriptionPlansSettings({
  branchId,
}: {
  branchId: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [branchId]);

  async function loadData() {
    setLoading(true);

    const { data: cats } = await supabase
      .from("subscription_categories")
      .select("id, name")
      .eq("branch_id", branchId)
      .order("sort_order", { ascending: true });

    const { data: pls } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("branch_id", branchId)
      .order("sort_order", { ascending: true });

    setCategories(cats || []);
    setPlans(pls || []);
    setLoading(false);
  }

  async function updatePlan(plan: Plan) {
    await supabase
      .from("subscription_plans")
      .update({
        name: plan.name,
        price: plan.price,
        duration_days: plan.duration_days,
        is_active: plan.is_active,
        category_id: plan.category_id,
      })
      .eq("id", plan.id);

    alert("Abbonamento aggiornato");
  }

  async function addPlan() {
    const categoryId = categories[0]?.id || null;

    await supabase.from("subscription_plans").insert({
      branch_id: branchId,
      category_id: categoryId,
      name: "Nuovo abbonamento",
      price: 0,
      duration_days: 30,
      is_active: true,
      sort_order: plans.length + 1,
    });

    loadData();
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Caricamento abbonamenti...</p>;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Categorie e piani abbonamento
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestisci prezzi, durata e stato degli abbonamenti.
          </p>
        </div>

        <button
          onClick={addPlan}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          + Nuovo piano
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
          >
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Nome
                </label>
                <input
                  value={plan.name}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id ? { ...p, name: e.target.value } : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Prezzo €
                </label>
                <input
                  type="number"
                  value={plan.price}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id
                          ? { ...p, price: Number(e.target.value) }
                          : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Durata giorni
                </label>
                <input
                  type="number"
                  value={plan.duration_days}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id
                          ? { ...p, duration_days: Number(e.target.value) }
                          : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Categoria
                </label>
                <select
                  value={plan.category_id || ""}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id
                          ? { ...p, category_id: e.target.value }
                          : p
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.id === plan.id
                            ? { ...p, is_active: e.target.checked }
                            : p
                        )
                      )
                    }
                  />
                  Attivo
                </label>

                <button
                  onClick={() => updatePlan(plan)}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}