import { NextResponse } from "next/server";

import { requirePermission } from "@/app/lib/server/permissions";

export async function GET() {
  const permission = await requirePermission(
    "manage_modules"
  );

  if (!permission.allowed) {
    return permission.response;
  }

  return NextResponse.json({
    ok: true,
    message: "API protetta funzionante",
  });
}