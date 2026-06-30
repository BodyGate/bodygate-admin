import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "../../../lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getCurrentAuthContext();

  return NextResponse.json({
    ok: true,
    user: {
      id: context.user.id,
      email: context.user.email,
      role: context.user.role,
    },
    role_key: context.roleKey,
    staff_name: context.staffName,
    permissions: context.permissions,
    is_admin: context.isAdmin,
  });
}
