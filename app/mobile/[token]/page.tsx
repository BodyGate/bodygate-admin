import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import type { Viewport } from "next";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050505",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isDateValid(value?: string | null) {
  if (!value) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date >= today;
}

function fullName(customer: any) {
  return `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Cliente";
}

function isCredentialActive(row: any) {
  return row?.is_active === true || String(row?.status || "").toLowerCase() === "active";
}

function getDnakeQrPayload(rows?: any[] | null) {
  const list = rows || [];
  const activeQr =
    list.find((row) => String(row?.qr_status || "").toLowerCase() === "active" && row?.qr_payload) ||
    list.find((row) => row?.qr_payload) ||
    null;

  return String(activeQr?.qr_payload || "").trim();
}

function getCredentialQrPayload(rows?: any[] | null) {
  const list = rows || [];
  const activeCredential =
    list.find((row) => row?.code && isCredentialActive(row)) ||
    list.find((row) => row?.code) ||
    null;

  return String(activeCredential?.code || "").trim();
}

async function loadMobilePass(token: string) {
  const { data: pass, error: passError } = await supabaseAdmin
    .from("customer_mobile_passes")
    .select("*")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (passError || !pass) {
    return {
      error: "Pass non valido o non attivo",
      pass: null,
      customer: null,
      qrPayload: "",
      qrImage: "",
      subscription: null,
      membershipFee: null,
      certificate: null,
    };
  }

  await supabaseAdmin
    .from("customer_mobile_passes")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", pass.id);

  const customerId = pass.customer_id;

  const [
    customerRes,
    dnakeQrRes,
    qrCredentialsRes,
    subscriptionRes,
    membershipRes,
    certificateRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle(),

    supabaseAdmin
      .from("customer_dnake_users")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5),

    supabaseAdmin
      .from("access_credentials")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "qr")
      .order("created_at", { ascending: false })
      .limit(5),

    supabaseAdmin
      .from("customer_subscriptions")
      .select("*")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin
      .from("customer_membership_fees")
      .select("*")
      .eq("customer_id", customerId)
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin
      .from("medical_certificates")
      .select("*")
      .eq("customer_id", customerId)
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const qrPayload = getDnakeQrPayload(dnakeQrRes.data) || getCredentialQrPayload(qrCredentialsRes.data);
  const qrImage = qrPayload
    ? await QRCode.toDataURL(qrPayload, {
        width: 560,
        margin: 1,
        errorCorrectionLevel: "M",
      })
    : "";

  return {
    error: null,
    pass,
    customer: customerRes.data || null,
    qrPayload,
    qrImage,
    subscription: subscriptionRes.data || null,
    membershipFee: membershipRes.data || null,
    certificate: certificateRes.data || null,
  };
}

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className={ok ? "status-row ok" : "status-row ko"}>
      <div className="status-dot">{ok ? "✓" : "!"}</div>
      <div className="status-text">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export default async function MobilePassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const {
    error,
    customer,
    qrPayload,
    qrImage,
    subscription,
    membershipFee,
    certificate,
  } = await loadMobilePass(token);

  if (error || !customer) {
    return (
      <main className="app-shell">
        <section className="error-card">
          <div className="brand">BODY ENERGY</div>
          <h1>Pass non disponibile</h1>
          <p>{error || "Cliente non trovato"}</p>
        </section>
        <style>{styles}</style>
      </main>
    );
  }

  const subscriptionValid = isDateValid(subscription?.ends_at);
  const membershipValid = isDateValid(membershipFee?.valid_until);
  const certificateValid = isDateValid(
    certificate?.valid_until || certificate?.expiry_date
  );

  const customerActive = customer.is_active !== false;
  const accessReady =
    Boolean(qrPayload) &&
    subscriptionValid &&
    membershipValid &&
    certificateValid &&
    customerActive;

  return (
    <main className="app-shell">
      <section className="top-card">
        <div className="brand-row">
          <div>
            <div className="brand">BODY ENERGY</div>
            <div className="subtitle">Mobile Pass</div>
          </div>

          <div className={accessReady ? "top-badge active" : "top-badge blocked"}>
            {accessReady ? "ATTIVO" : "VERIFICA"}
          </div>
        </div>

        <h1>{fullName(customer)}</h1>

        <p>
          Mostra il QR al lettore per accedere alla palestra.
        </p>
      </section>

      <section className={accessReady ? "qr-card active" : "qr-card blocked"}>
        <div className="qr-header">
          <span>{accessReady ? "Accesso consentito" : "Accesso da verificare"}</span>
          <b>{accessReady ? "OK" : "STOP"}</b>
        </div>

        {qrImage ? (
          <div className="qr-frame">
            <img src={qrImage} alt="QR Code accesso BodyGate" />
          </div>
        ) : (
          <div className="no-qr">
            QR Code non ancora generato. Genera il QR DNake dalla scheda cliente in reception.
          </div>
        )}

        <div className="qr-help">
          Tieni alta la luminosità dello schermo e avvicina il QR al lettore.
        </div>
      </section>

      <section className="status-card">
        <h2>Stato accesso</h2>

        <StatusRow
          ok={customerActive}
          label="Cliente"
          detail={customerActive ? "Profilo attivo" : "Profilo disattivato"}
        />

        <StatusRow
          ok={subscriptionValid}
          label="Abbonamento"
          detail={
            subscriptionValid
              ? `Valido fino al ${formatDate(subscription?.ends_at)}`
              : "Scaduto o non presente"
          }
        />

        <StatusRow
          ok={membershipValid}
          label="Quota associativa"
          detail={
            membershipValid
              ? `Valida fino al ${formatDate(membershipFee?.valid_until)}`
              : "Scaduta o non presente"
          }
        />

        <StatusRow
          ok={certificateValid}
          label="Certificato medico"
          detail={
            certificateValid
              ? `Valido fino al ${formatDate(
                  certificate?.valid_until || certificate?.expiry_date
                )}`
              : "Scaduto o non presente"
          }
        />
      </section>

      <section className="install-card">
        <strong>Installa come app</strong>
        <span>
          iPhone: Condividi → Aggiungi a Home. Android: menu Chrome → Aggiungi a schermata Home.
        </span>
      </section>

      <style>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background: #050505;
    color: white;
    font-family: Arial, Helvetica, sans-serif;
    overflow-x: hidden;
  }

  body {
    width: 100%;
  }

  .app-shell {
    width: 100%;
    min-height: 100svh;
    padding: max(14px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
    background:
      radial-gradient(circle at top left, rgba(239, 68, 68, 0.32), transparent 34%),
      radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 32%),
      linear-gradient(180deg, #09090b, #000);
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .top-card,
  .qr-card,
  .status-card,
  .install-card,
  .error-card {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(15, 15, 18, 0.92);
    border-radius: 26px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
  }

  .top-card {
    padding: 20px;
  }

  .brand-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .brand {
    color: #ef4444;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: 2.4px;
  }

  .subtitle {
    color: #94a3b8;
    font-size: 12px;
    font-weight: 800;
    margin-top: 4px;
  }

  .top-badge {
    border-radius: 999px;
    padding: 8px 11px;
    font-size: 11px;
    font-weight: 950;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .top-badge.active {
    color: #86efac;
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.32);
  }

  .top-badge.blocked {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.32);
  }

  h1 {
    margin: 18px 0 8px;
    font-size: clamp(28px, 8vw, 38px);
    line-height: 0.98;
    letter-spacing: -1.6px;
    word-break: break-word;
  }

  p {
    margin: 0;
    color: #cbd5e1;
    font-size: 14px;
    line-height: 1.45;
  }

  .qr-card {
    padding: 14px;
  }

  .qr-card.active {
    border-color: rgba(34, 197, 94, 0.34);
  }

  .qr-card.blocked {
    border-color: rgba(239, 68, 68, 0.34);
  }

  .qr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 4px 4px 12px;
  }

  .qr-header span {
    font-size: 17px;
    font-weight: 950;
  }

  .qr-header b {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.10);
    padding: 7px 10px;
    font-size: 12px;
  }

  .qr-frame {
    width: 100%;
    background: white;
    border-radius: 24px;
    padding: 12px;
    display: grid;
    place-items: center;
  }

  .qr-frame img {
    width: 100%;
    max-width: min(82vw, 360px);
    height: auto;
    display: block;
  }

  .no-qr {
    border-radius: 20px;
    padding: 22px;
    background: rgba(239, 68, 68, 0.14);
    color: #fecaca;
    line-height: 1.5;
  }

  .qr-help {
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.4;
    text-align: center;
    padding: 12px 6px 2px;
  }

  .status-card {
    padding: 18px;
  }

  h2 {
    margin: 0 0 13px;
    font-size: 20px;
    letter-spacing: -0.4px;
  }

  .status-row {
    display: grid;
    grid-template-columns: 38px 1fr;
    gap: 12px;
    align-items: center;
    border-radius: 18px;
    padding: 13px;
    margin-top: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .status-row.ok {
    background: rgba(34, 197, 94, 0.10);
  }

  .status-row.ko {
    background: rgba(239, 68, 68, 0.10);
  }

  .status-dot {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-weight: 950;
    background: rgba(255, 255, 255, 0.10);
  }

  .status-row.ok .status-dot {
    color: #86efac;
  }

  .status-row.ko .status-dot {
    color: #fca5a5;
  }

  .status-text strong {
    display: block;
    font-size: 15px;
  }

  .status-text span {
    display: block;
    color: #cbd5e1;
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.35;
  }

  .install-card {
    display: grid;
    gap: 5px;
    padding: 16px 18px;
    margin-bottom: 8px;
  }

  .install-card strong {
    font-size: 15px;
  }

  .install-card span {
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.45;
  }

  .error-card {
    margin-top: 60px;
    padding: 22px;
  }

  @media (max-width: 360px) {
    .app-shell {
      padding-left: 10px;
      padding-right: 10px;
    }

    .qr-frame {
      padding: 9px;
      border-radius: 20px;
    }

    .top-card,
    .qr-card,
    .status-card,
    .install-card,
    .error-card {
      border-radius: 22px;
    }
  }
`;
