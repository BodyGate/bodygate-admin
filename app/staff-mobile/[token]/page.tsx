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

export default async function StaffMobilePassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = getSupabaseAdmin();

  const { data: pass } = await supabase
    .from("staff_mobile_passes")
    .select("*")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!pass) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Staff Pass non trovato</h1>
          <p style={styles.text}>
            Il pass richiesto non esiste oppure è stato disattivato.
          </p>
        </div>
      </main>
    );
  }

  await supabase
    .from("staff_mobile_passes")
    .update({
      last_opened_at: new Date().toISOString(),
    })
    .eq("id", pass.id);

  const { data: staff } = await supabase
    .from("staff_users")
    .select(
      `
      id,
      full_name,
      email,
      is_active,
      staff_roles (
        role_name
      )
    `
    )
    .eq("id", pass.staff_user_id)
    .maybeSingle();

  const { data: credential } = await supabase
    .from("staff_access_credentials")
    .select("*")
    .eq("staff_user_id", pass.staff_user_id)
    .eq("type", "qr")
    .eq("status", "active")
    .maybeSingle();

  if (!credential) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>QR Staff non disponibile</h1>
          <p style={styles.text}>
            Nessuna credenziale QR attiva associata allo staff.
          </p>
        </div>
      </main>
    );
  }

  const qrDataUrl = await QRCode.toDataURL(credential.code, {
    width: 512,
    margin: 2,
  });

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span>BG</span>
        </div>

        <h1 style={styles.title}>BodyGate Staff Pass</h1>

        <p style={styles.staffName}>
          {staff?.full_name || "Staff Body Energy"}
        </p>

        <p style={styles.role}>
          {(staff?.staff_roles as any)?.role_name || "Staff"}
        </p>

        <div style={styles.qrBox}>
          <img
            src={qrDataUrl}
            alt="Staff QR"
            width={320}
            height={320}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 20,
            }}
          />
        </div>

        <div style={styles.status}>
          <span style={styles.greenDot} />
          Accesso Staff Attivo
        </div>

        <p style={styles.instructions}>
          Mostra questo QR al lettore per accedere alla palestra.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(239,68,68,.25), #020617 45%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 480,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 32,
    padding: 32,
    textAlign: "center",
    color: "#fff",
    boxShadow: "0 30px 60px rgba(0,0,0,.45)",
  },

  logo: {
    width: 90,
    height: 90,
    margin: "0 auto 24px",
    borderRadius: 24,
    background:
      "linear-gradient(135deg,#ef4444 0%,#991b1b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 34,
  },

  title: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 10,
  },

  staffName: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
  },

  role: {
    color: "#94a3b8",
    marginBottom: 24,
  },

  qrBox: {
    background: "#fff",
    padding: 18,
    borderRadius: 24,
    marginBottom: 24,
  },

  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 18px",
    borderRadius: 999,
    background: "rgba(34,197,94,.15)",
    color: "#4ade80",
    fontWeight: 700,
    marginBottom: 18,
  },

  greenDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#22c55e",
  },

  instructions: {
    color: "#cbd5e1",
    lineHeight: 1.6,
  },

  text: {
    color: "#cbd5e1",
  },
};