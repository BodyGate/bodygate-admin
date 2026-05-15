"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type MembershipFee = {
  id: string;
  name: string;
  price: number;
  validity_days: number;
  required_for_access: boolean;
  is_active: boolean;
};

export default function MembershipFeeSettings({
  branchId,
}: {
  branchId: string;
}) {
  const [fee, setFee] = useState<MembershipFee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFee();
  }, [branchId]);

  async function loadFee() {
    setLoading(true);

    const { data } = await supabase
      .from("membership_fee_settings")
      .select("*")
      .eq("branch_id", branchId)
      .limit(1)
      .maybeSingle();

    setFee(data);
    setLoading(false);
  }

  async function saveFee() {
    if (!fee) return;

    setSaving(true);

    await supabase
      .from("membership_fee_settings")
      .update({
        name: fee.name,
        price: fee.price,
        validity_days: fee.validity_days,
        required_for_access: fee.required_for_access,
        is_active: fee.is_active,
      })
      .eq("id", fee.id);

    setSaving(false);
    alert("Quota associativa aggiornata");
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Caricamento quota...</p>;
  }

  if (!fee) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Nessuna quota associativa trovata per questa sede.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Quota associativa
      </h2>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nome quota
          </label>
          <input
            value={fee.name}
            onChange={(e) => setFee({ ...fee, name: e.target.value })}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Importo €
          </label>
          <input
            type="number"
            value={fee.price}
            onChange={(e) =>
              setFee({ ...fee, price: Number(e.target.value) })
            }
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Validità giorni
          </label>
          <input
            type="number"
            value={fee.validity_days}
            onChange={(e) =>
              setFee({ ...fee, validity_days: Number(e.target.value) })
            }
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3 pt-7">
          <input
            type="checkbox"
            checked={fee.required_for_access}
            onChange={(e) =>
              setFee({ ...fee, required_for_access: e.target.checked })
            }
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Obbligatoria per accedere
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          type="checkbox"
          checked={fee.is_active}
          onChange={(e) => setFee({ ...fee, is_active: e.target.checked })}
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Quota attiva
        </span>
      </div>

      <button
        onClick={saveFee}
        disabled={saving}
        className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {saving ? "Salvataggio..." : "Salva quota associativa"}
      </button>
    </div>
  );
}