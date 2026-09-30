/**
 * Per-IP budget for requests paid by the server's API key (a build costs 3,
 * everything else 1). In-memory per function instance — with Fluid compute
 * instances are reused, which is enough to stop casual abuse of a demo key.
 * Requests with the user's own key are not limited.
 */
const WINDOW_MS = 15 * 60 * 1000;
const buckets = new Map<string, { points: number; resetAt: number }>();

export function takeRateLimit(key: string, cost: number, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const limit = Number(process.env.LUNOR_RATE_LIMIT) || 45;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { points: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  if (bucket.points + cost > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.points += cost;
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  return { ok: true };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'local'
  );
}

export function resetRateLimits() {
  buckets.clear();
}
