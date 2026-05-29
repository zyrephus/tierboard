import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';

// Shared, cross-instance rate limiting backed by Upstash Redis. Unlike an
// in-memory Map, this counts requests across every serverless instance and
// survives cold starts, so it actually holds on Vercel.
//
// If the Upstash env vars are absent (e.g. local dev or a fork without an
// Upstash project) we fail open — no limiting — so the app still runs.
const configured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Per-instance cache so an already-blocked IP short-circuits without a Redis
// round-trip. Must live at module scope, not inside the handler.
const ephemeralCache = new Map<string, number>();

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

function makeLimiter(prefix: string, max: number, window: Duration): Ratelimit | null {
  if (!configured) return null;
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(max, window),
    ephemeralCache,
    analytics: true,
    prefix,
  });
}

// Vote cap is generous enough for fast legitimate clicking but caps a single
// IP hard. Tune VOTE_MAX if real users hit it. Suggestions stay tight.
export const voteLimiter = makeLimiter('rl:vote', 20, '60 s');
export const suggestLimiter = makeLimiter('rl:suggest', 5, '15 m');

// Trust the platform-resolved client IP. Reading x-forwarded-for[0] ourselves
// is wrong: that entry is client-supplied and trivially spoofed, which defeats
// any per-IP limit. @vercel/functions returns the IP Vercel's edge observed.
export function clientIp(req: Request): string {
  return ipAddress(req) ?? 'unknown';
}

// Returns true if the request should be rejected.
export async function isRateLimited(limiter: Ratelimit | null, ip: string): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit(ip);
  return !success;
}
