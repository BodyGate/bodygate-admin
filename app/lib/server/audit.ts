import { supabase } from "../supabaseClient";

const CURRENT_STAFF_EMAIL = "admin@bodygate.it";

export async function writeAuditLog({
  action,
  entityType,
  entityId,
  details,
  ipAddress,
}: {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  const { data: staffUser } = await supabase
    .from("staff_users")
    .select("full_name,email")
    .eq("email", CURRENT_STAFF_EMAIL)
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    staff_email: staffUser?.email || CURRENT_STAFF_EMAIL,
    staff_name: staffUser?.full_name || "Admin BodyGate",
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    details: details || null,
    ip_address: ipAddress || null,
  });
}