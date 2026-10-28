import { passManifestResponse } from "../../../lib/passManifest";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  return passManifestResponse("staff-mobile", token);
}
