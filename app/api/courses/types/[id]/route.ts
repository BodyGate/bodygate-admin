import { NextResponse } from "next/server";
import { getCourseSupabaseClient } from "../../../../lib/server/courseRpc";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "is_active deve essere un booleano." },
        { status: 400 },
      );
    }

    const supabase = getCourseSupabaseClient();
    const { error } = await supabase
      .from("course_types")
      .update({ is_active: body.is_active })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore aggiornamento tipo corso.",
      },
      { status: 500 },
    );
  }
}
