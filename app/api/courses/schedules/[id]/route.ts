import { NextResponse } from "next/server";
import { getCourseSupabaseClient } from "../../../../lib/server/courseRpc";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["draft", "active", "paused", "archived"];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(body.status || "").trim();

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Stato non valido: deve essere uno tra ${ALLOWED_STATUSES.join(", ")}.` },
        { status: 400 },
      );
    }

    const supabase = getCourseSupabaseClient();
    const { error } = await supabase
      .from("course_schedules")
      .update({ status })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore aggiornamento stato orario corso.",
      },
      { status: 500 },
    );
  }
}
