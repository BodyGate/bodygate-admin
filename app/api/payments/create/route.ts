import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerId = body.customerId || null;
    const paymentMethodId = body.paymentMethodId || null;
    const paymentType = String(body.paymentType || "").trim();
    const amount = Number(body.amount || 0);
    const description = String(body.description || "").trim();
    const planId = body.planId || null;

    if (!paymentType) {
      return NextResponse.json({ ok: false, error: "Tipo pagamento mancante" }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Importo non valido" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: customer } = customerId
      ? await supabase
          .from("customers")
          .select("id, branch_id, first_name, last_name")
          .eq("id", customerId)
          .maybeSingle()
      : { data: null };

    const branchId = customer?.branch_id || null;

    const { data: method } = paymentMethodId
      ? await supabase
          .from("payment_methods")
          .select("id, name, method_key")
          .eq("id", paymentMethodId)
          .maybeSingle()
      : { data: null };

    const paymentMethodName = method?.method_key || method?.name || null;

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount,
        payment_type: paymentType,
        description: description || null,
        status: "paid",
        paid_at: now,
        created_by: "admin@bodygate.it",
      })
      .select("id")
      .single();

    if (paymentError) {
      return NextResponse.json(
        { ok: false, error: paymentError.message },
        { status: 500 }
      );
    }

    await supabase.from("customer_payments").insert({
      customer_id: customerId,
      amount,
      type: paymentType,
      description: description || null,
      payment_method: paymentMethodName,
      status: "paid",
      paid_at: now,
      notes: null,
    });

    await supabase.from("cash_movements").insert({
      movement_type: "income",
      amount,
      category: paymentType,
      description: description || "Incasso registrato",
      payment_id: payment.id,
      created_by: "admin@bodygate.it",
      movement_at: now,
    });

    if (customerId && paymentType === "membership_fee") {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 365);

      await supabase.from("customer_membership_fees").insert({
        customer_id: customerId,
        branch_id: branchId,
        amount,
        valid_from: now.slice(0, 10),
        valid_until: validUntil.toISOString().slice(0, 10),
        payment_method: paymentMethodName,
      });

      await supabase.from("customer_timeline").insert({
        customer_id: customerId,
        type: "membership",
        title: "Quota associativa rinnovata",
        description: `Quota associativa €${amount.toFixed(2)} valida fino al ${validUntil
          .toISOString()
          .slice(0, 10)}`,
      });
    }

    if (customerId && paymentType === "subscription") {
      let durationDays = 30;
      let planName = "Abbonamento";

      if (planId) {
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id, name, duration_days")
          .eq("id", planId)
          .maybeSingle();

        if (plan?.duration_days) durationDays = Number(plan.duration_days);
        if (plan?.name) planName = plan.name;
      }

      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + durationDays);

      await supabase.from("customer_subscriptions").insert({
        customer_id: customerId,
        branch_id: branchId,
        plan_id: planId,
        amount,
        starts_at: startsAt.toISOString().slice(0, 10),
        ends_at: endsAt.toISOString().slice(0, 10),
        is_active: true,
        payment_method: paymentMethodName,
        notes: description || null,
      });

      await supabase.from("customer_timeline").insert({
        customer_id: customerId,
        type: "subscription",
        title: "Abbonamento rinnovato",
        description: `${planName} €${amount.toFixed(2)} valido fino al ${endsAt
          .toISOString()
          .slice(0, 10)}`,
      });
    }

    return NextResponse.json({
      ok: true,
      payment_id: payment.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore imprevisto",
      },
      { status: 500 }
    );
  }
}