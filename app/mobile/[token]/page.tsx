import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

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
    qrRes,
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
      .from("access_credentials")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "qr")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

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

  const qrPayload = qrRes.data?.code || "";
  const qrImage = qrPayload
    ? await QRCode.toDataURL(qrPayload, {
        width: 340,
        margin: 2,
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

function StatusPill({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className={ok ? "status ok" : "status ko"}>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <b>{ok ? "OK" : "NO"}</b>
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
      <main className="mobile-page">
        <section className="card error">
          <h1>Pass non disponibile</h1>
          <p>{error || "Cliente non trovato"}</p>
        </section>

        <style>{styles}</style>
      </main>
    );
  }

  const subscriptionValid = isDateValid(subscription?.ends_at);
  const membershipValid = isDateValid(membershipFee?.valid_until);
  const certificateValid = isDateValid(certificate?.valid_until || certificate?.expiry_date);
  const accessReady = Boolean(qrPayload) && subscriptionValid && membershipValid && certificateValid && customer.is_active !== false;

  return (
    <main className="mobile-page">
      <section className="hero">
        <div className="brand">BODY ENERGY</div>
        <h1>Ciao, {fullName(customer)}</h1>
        <p>Il tuo pass digitale BodyGate</p>
      </section>

      <section className={accessReady ? "access-card active" : "access-card blocked"}>
        <div className="access-title">
          <span>{accessReady ? "Accesso attivo" : "Accesso da verificare"}</span>
          <b>{accessReady ? "ENTRA" : "STOP"}</b>
        </div>

        {qrImage ? (
          <div className="qr-wrap">
            <img src={qrImage} alt="QR Code accesso BodyGate" />
          </div>
        ) : (
          <div className="no-qr">
            QR Code non ancora generato. Rivolgiti alla reception.
          </div>
        )}

        <p className="hint">Mostra questo QR al lettore all'ingresso.</p>
      </section>

      <section className="card">
        <h2>Stato iscrizione</h2>

        <StatusPill
          ok={customer.is_active !== false}
          label="Cliente"
          detail={customer.is_active !== false ? "Attivo" : "Disattivato"}
        />

        <StatusPill
          ok={subscriptionValid}
          label="Abbonamento"
          detail={
            subscriptionValid
              ? `Valido fino al ${formatDate(subscription?.ends_at)}`
              : "Scaduto o non presente"
          }
        />

        <StatusPill
          ok={membershipValid}
          label="Quota associativa"
          detail={
            membershipValid
              ? `Valida fino al ${formatDate(membershipFee?.valid_until)}`
              : "Scaduta o non presente"
          }
        />

        <StatusPill
          ok={certificateValid}
          label="Certificato medico"
          detail={
            certificateValid
              ? `Valido fino al ${formatDate(certificate?.valid_until || certificate?.expiry_date)}`
              : "Scaduto o non presente"
          }
        />
      </section>

      <section className="footer-card">
        <strong>BodyGate Mobile Pass</strong>
        <span>Salva questa pagina sulla schermata Home del telefono.</span>
      </section>

      <style>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #050505;
    color: white;
    font-family: Arial, Helvetica, sans-serif;
  }

  .mobile-page {
    min-height: 100vh;
    padding: 18px;
    background:
      radial-gradient(circle at top, rgba(239,68,68,0.30), transparent 34%),
      linear-gradient(180deg, #09090b, #000);
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .hero {
    padding: 20px 4px 4px;
  }

  .brand {
    color: #ef4444;
    font-size: 13px;
    font-weight: 950;
    letter-spacing: 2.6px;
  }

  h1 {
    margin: 8px 0 4px;
    font-size: 30px;
    line-height: 1.05;
    letter-spacing: -1px;
  }

  p {
    margin: 0;
    color: #cbd5e1;
  }

  .access-card,
  .card,
  .footer-card {
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(24,24,27,0.88);
    border-radius: 28px;
    padding: 18px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.36);
  }

  .access-card.active {
    border-color: rgba(34,197,94,0.35);
  }

  .access-card.blocked {
    border-color: rgba(239,68,68,0.35);
  }

  .access-title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
  }

  .access-title span {
    font-size: 18px;
    font-weight: 950;
  }

  .access-title b {
    border-radius: 999px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.10);
    color: #fff;
    font-size: 12px;
  }

  .qr-wrap {
    background: white;
    border-radius: 24px;
    padding: 14px;
    display: grid;
    place-items: center;
  }

  .qr-wrap img {
    width: 100%;
    max-width: 340px;
    height: auto;
    display: block;
  }

  .no-qr {
    border-radius: 20px;
    padding: 22px;
    background: rgba(239,68,68,0.14);
    color: #fecaca;
    line-height: 1.5;
  }

  .hint {
    margin-top: 12px;
    text-align: center;
    font-size: 14px;
    color: #cbd5e1;
  }

  h2 {
    margin: 0 0 14px;
    font-size: 20px;
    letter-spacing: -0.4px;
  }

  .status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-radius: 18px;
    padding: 13px 14px;
    margin-top: 10px;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .status strong {
    display: block;
    font-size: 15px;
  }

  .status span {
    display: block;
    margin-top: 3px;
    color: #cbd5e1;
    font-size: 13px;
  }

  .status.ok {
    background: rgba(34,197,94,0.10);
  }

  .status.ko {
    background: rgba(239,68,68,0.10);
  }

  .status.ok b {
    color: #86efac;
  }

  .status.ko b {
    color: #fca5a5;
  }

  .footer-card {
    display: grid;
    gap: 5px;
    color: #cbd5e1;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .footer-card strong {
    color: white;
    font-size: 15px;
  }

  .error {
    margin-top: 60px;
  }
`;
