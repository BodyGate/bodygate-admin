import { withPermission } from "../../../lib/server/auth";
import { POST as ensureDigitalPassPost } from "../../customers/ensure-digital-pass/route";

export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  return ensureDigitalPassPost(request);
}

export const POST = withPermission("manage_access", handlePOST);
