import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function MobilePassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = getSupabaseAdmin();

  const { data: pass } = await supabase
    .from("customer_mobile_passes")
    .select("id, customer_id, public_token, is_active")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!pass) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1>Mobile Pass non valido</h1>
        </div>
      </main>
    );
  }

  const { data: customer } = await supabase
    .from("customers")
    .select(
      `
      first_name,
      last_name,
      is_active
    `
    )
    .eq("id", pass.customer_id)
    .maybeSingle();

  const { data: qrCredential } = await supabase
    .from("access_credentials")
    .select("code")
    .eq("customer_id", pass.customer_id)
    .eq("type", "qr")
    .eq("status", "active")
    .maybeSingle();

  if (!qrCredential?.code) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1>QR non disponibile</h1>
        </div>
      </main>
    );
  }

  const qrDataUrl = await QRCode.toDataURL(qrCredential.code);

  await supabase
    .from("customer_mobile_passes")
    .update({
      last_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pass.id);

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>BODY ENERGY</h1>

        <p style={styles.name}>
          {customer?.first_name} {customer?.last_name}
        </p>

        <img
          src={qrDataUrl}
          alt="QR Code"
          width={280}
          height={280}
          style={styles.qr}
        />

        <div style={styles.badge}>
          {customer?.is_active ? "ACCESSO ATTIVO" : "ACCESSO NON ATTIVO"}
        </div>

        <p style={styles.info}>
          Mostra questo QR al lettore per accedere alla palestra.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#0f172a",
    borderRadius: 28,
    padding: 30,
    textAlign: "center",
    border: "1px solid rgba(255,255,255,.08)",
  },
  title: {
    color: "#5b3df5",
    marginBottom: 12,
  },
  name: {
    color: "#fff",
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 24,
  },
  qr: {
    borderRadius: 18,
    background: "#fff",
    padding: 12,
  },
  badge: {
    marginTop: 24,
    padding: "12px 18px",
    borderRadius: 999,
    background: "rgba(34,197,94,.15)",
    color: "#4ade80",
    fontWeight: 700,
  },
  info: {
    color: "#cbd5e1",
    marginTop: 18,
  },
};