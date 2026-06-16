import type { SupabaseClient } from "@supabase/supabase-js";

export const BODYGATE_DEFAULT_BRANCH_FALLBACK_ID =
  "ffbd8d1a-35a8-4b3e-8219-e9a56533d30c";

export type OperationalBranch = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
};

function isActiveBranch(row: any) {
  const status = String(row?.status || "").toLowerCase();
  return row?.is_active === true || row?.active === true || status === "active";
}

export async function getDefaultOperationalBranch(
  supabase: SupabaseClient,
): Promise<OperationalBranch | null> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, address, city, is_active, active, status")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("default operational branch lookup failed", error);
    return null;
  }

  const activeBranches = (data || []).filter(isActiveBranch);
  const branches = activeBranches.length > 0 ? activeBranches : data || [];

  const singleActiveBranch = activeBranches.length === 1 ? activeBranches[0] : null;
  const bodyEnergyBranch = branches.find(
    (branch: any) => branch.id === BODYGATE_DEFAULT_BRANCH_FALLBACK_ID,
  );
  const selected = singleActiveBranch || bodyEnergyBranch || branches[0] || null;

  if (!selected?.id) return null;

  return {
    id: selected.id,
    name: selected.name || null,
    address: selected.address || null,
    city: selected.city || null,
  };
}

export async function tableHasColumn(
  supabase: SupabaseClient,
  tableName: string,
  columnName: string,
) {
  const { error } = await supabase
    .from(tableName)
    .select(columnName)
    .limit(1);

  if (!error) return true;

  const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  if (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("42703") ||
    message.includes("schema cache")
  ) {
    return false;
  }

  console.warn(`column lookup failed for ${tableName}.${columnName}`, error);
  return false;
}
