import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      {
        ok: false,
        message: "Cliente non trovato.",
      },
      { status: 404 }
    );
  }

  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";

  const contractUrl = `${protocol}://${host}/customers/${id}/contract`;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.goto(contractUrl, {
      waitUntil: "networkidle0",
    });

    await page.addStyleTag({
      content: `
        .no-print {
          display: none !important;
        }

        body {
          background: white !important;
        }
      `,
    });

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

    const safeName =
      customer.full_name ||
      `${customer.first_name || ""}_${customer.last_name || ""}`.trim() ||
      "cliente";

    const cleanName = safeName
      .replaceAll(" ", "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const fileName = `contratto-${cleanName}-${Date.now()}.pdf`;
    const filePath = `${id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, Buffer.from(pdfBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Errore upload PDF: " + uploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("documents").insert({
      customer_id: id,
      title: "Contratto sala Body Energy",
      type: "contract",
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      file_name: fileName,
      status: "generated",
    });

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          message: "PDF generato ma non salvato nel database: " + insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contratto PDF generato e salvato in archivio.",
      file_url: publicUrlData.publicUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Errore generazione PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}