// Best-effort, per-instance sliding-window rate limiter. On a single Windows
// PC (the local BodyGate deployment) this is a real, durable limit. On
// Vercel's serverless runtime each instance keeps its own counters, so the
// effective ceiling under heavy concurrent traffic is higher than the
// configured limit - it is defense in depth alongside machine-key auth
// (BODYGATE_MACHINE_AUTH_MODE), not a replacement for it.

type Bucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, Bucket>();

// Unbounded growth guard: if a deployment sees many distinct IPs, prune
// expired buckets opportunistically instead of letting the map grow forever.
const MAX_TRACKED_KEYS = 5000;

export function isRateLimited(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });

    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [bucketKey, bucket] of buckets) {
        if (now - bucket.windowStartedAt >= windowMs) {
          buckets.delete(bucketKey);
        }
      }
    }

    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}
