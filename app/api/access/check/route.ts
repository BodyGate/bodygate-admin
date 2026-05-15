import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "BodyGate access check API attiva",
    method: "POST required",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const badge = String(body.badge || body.badge_code || "").trim();

    if (!badge) {
      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Badge mancante",
      });
    }

    const { data: badgeRow, error: badgeError } = await supabase
      .from("customer_badges")
      .select("*")
      .eq("badge_code", badge)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (badgeError || !badgeRow) {
      await supabase.from("unknown_badge_logs").insert({
        badge_code: badge,
        reason: "Badge non riconosciuto",
        source: "turnstile",
      });

      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Badge non riconosciuto",
        badge_code: badge,
      });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", badgeRow.customer_id)
      .eq("is_active", true)
      .maybeSingle();

    if (customerError || !customer) {
      await supabase.from("unknown_badge_logs").insert({
        badge_code: badge,
        reason: "Badge associato a cliente non attivo",
        source: "turnstile",
      });

      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Cliente non attivo",
        badge_code: badge,
      });
    }

    const customerId = customer.id;
    const branchId = customer.branch_id;
    const today = new Date().toISOString().slice(0, 10);

    async function logAccess(wasAllowed: boolean, reason: string) {
      await supabase.from("customer_access_logs").insert({
        customer_id: customerId,
        branch_id: branchId,
        was_allowed: wasAllowed,
        reason,
        badge_code: badge,
        controller_code: badge,
      });
    }

    if (!branchId) {
      await logAccess(false, "Cliente non associato a nessuna sede");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Cliente non associato a nessuna sede",
        customer_id: customerId,
        badge_code: badge,
      });
    }

    const { data: activeBlock } = await supabase
      .from("customer_blocks")
      .select("*")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();

    if (activeBlock) {
      const reason = `Accesso bloccato: ${activeBlock.reason}`;
      await logAccess(false, reason);

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason,
        customer_id: customerId,
        badge_code: badge,
      });
    }

    const medicalCertificateEnd =
      customer.medical_certificate_end_date ||
      customer.medical_certificate_end;

    if (!medicalCertificateEnd || medicalCertificateEnd < today) {
      await logAccess(false, "Certificato medico scaduto o mancante");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Certificato medico scaduto o mancante",
        customer_id: customerId,
        badge_code: badge,
      });
    }

    const { data: membershipSetting } = await supabase
      .from("membership_fee_settings")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (membershipSetting?.required_for_access) {
      const { data: validMembershipFee } = await supabase
        .from("customer_membership_fees")
        .select("*")
        .eq("customer_id", customerId)
        .eq("branch_id", branchId)
        .lte("valid_from", today)
        .gte("valid_until", today)
        .order("valid_until", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!validMembershipFee) {
        await logAccess(false, "Quota associativa assente o scaduta");

        return NextResponse.json({
          ok: true,
          allowed: false,
          reason: "Quota associativa assente o scaduta",
          customer_id: customerId,
          badge_code: badge,
        });
      }
    }

    const { data: validSubscription } = await supabase
      .from("customer_subscriptions")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .lte("starts_at", today)
      .gte("ends_at", today)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!validSubscription) {
      await logAccess(false, "Abbonamento assente o scaduto");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Abbonamento assente o scaduto",
        customer_id: customerId,
        badge_code: badge,
      });
    }

    await logAccess(true, "Accesso consentito");

    return NextResponse.json({
      ok: true,
      allowed: true,
      reason: "Accesso consentito",
      customer_id: customerId,
      badge_code: badge,
      customer_name:
        `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        reason: "Errore interno controllo accesso",
        error: String(error),
      },
      { status: 500 }
    );
  }
}