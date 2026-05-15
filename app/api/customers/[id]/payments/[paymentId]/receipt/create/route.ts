import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
    paymentId: string;
  }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { id, paymentId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("customer_id", id)
    .single();

  if (!customer || !payment) {
    return NextResponse.json({
      ok: false,
      message: "Cliente o pagamento non trovato.",
    });
  }

  const customerName =
    customer.full_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Cliente";

  const today = new Date().toLocaleDateString("it-IT");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 22mm;
            box-sizing: border-box;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #111;
            padding-bottom: 18px;
            margin-bottom: 30px;
          }

          .brand {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: 1px;
          }

          .subtitle {
            margin-top: 6px;
            font-size: 14px;
          }

          .title {
            font-size: 22px;
            font-weight: 900;
            margin: 30px 0 20px;
            text-align: center;
          }

          .row {
            display: grid;
            grid-template-columns: 190px 1fr;
            border-bottom: 1px solid #ddd;
            padding: 12px 0;
            font-size: 14px;
          }

          .label {
            font-weight: 800;
          }

          .amount {
            margin-top: 34px;
            padding: 22px;
            border: 2px solid #111;
            border-radius: 16px;
            text-align: center;
          }

          .amount-label {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .amount-value {
            margin-top: 8px;
            font-size: 38px;
            font-weight: 900;
          }

          .note {
            margin-top: 30px;
            font-size: 13px;
            line-height: 1.6;
          }

          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-top: 80px;
          }

          .signature-line {
            border-bottom: 1px solid #111;
            height: 60px;
          }

          .signature-label {
            text-align: center;
            margin-top: 10px;
            font-size: 12px;
          }
        </style>
      </head>

      <body>
        <div class="page">
          <div class="header">
            <div class="brand">BODY ENERGY</div>
            <div class="subtitle">Associazione Sportiva Dilettantistica</div>
          </div>

          <div class="title">RICEVUTA PAGAMENTO</div>

          <div class="row">
            <div class="label">Data ricevuta</div>
            <div>${today}</div>
          </div>

          <div class="row">
            <div class="label">Cliente</div>
            <div>${customerName}</div>
          </div>

          <div class="row">
            <div class="label">Descrizione</div>
            <div>${payment.description || "Pagamento palestra"}</div>
          </div>

          <div class="row">
            <div class="label">Metodo pagamento</div>
            <div>${payment.payment_method || "-"}</div>
          </div>

          <div class="row">
            <div class="label">Giorni abbonamento</div>
            <div>${payment.subscription_days || 0}</div>
          </div>

          <div class="row">
            <div class="label">Data pagamento</div>
            <div>${new Date(payment.created_at).toLocaleString("it-IT")}</div>
          </div>

          <div class="amount">
            <div class="amount-label">Importo ricevuto</div>
            <div class="amount-value">€ ${Number(payment.amount).toFixed(2)}</div>
          </div>

          <div class="note">
            La presente ricevuta attesta la registrazione del pagamento indicato
            nel gestionale BodyGate per servizi sportivi e/o rinnovo abbonamento
            presso Body Energy A.S.D.
          </div>

          <div class="signatures">
            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Firma cliente</div>
            </div>

            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Firma responsabile</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(receiptHtml, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    const cleanName = customerName
      .replaceAll(" ", "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const fileName = `ricevuta-${cleanName}-${Date.now()}.pdf`;
    const filePath = `${id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, Buffer.from(pdfBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({
        ok: false,
        message: "Errore upload ricevuta: " + uploadError.message,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("documents").insert({
      customer_id: id,
      title: `Ricevuta pagamento € ${Number(payment.amount).toFixed(2)}`,
      type: "receipt",
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      file_name: fileName,
      status: "generated",
    });

    if (insertError) {
      return NextResponse.json({
        ok: false,
        message: "PDF creato ma errore salvataggio archivio.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Ricevuta generata correttamente.",
      file_url: publicUrlData.publicUrl,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Errore generazione ricevuta.",
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}