import { POST as ensureDigitalPassPost } from "../../customers/ensure-digital-pass/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return ensureDigitalPassPost(request);
}
