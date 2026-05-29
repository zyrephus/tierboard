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

// Layered limits: a request is rejected if it trips ANY limiter. The burst cap
// stops someone dumping a whole minute's quota in one second; the sustained cap
// bounds the total per minute. Both are generous for real clicking (~1/s) but
// throttle a script. Tune the numbers if real users ever hit them.
export const voteLimiters = [
  makeLimiter('rl:vote:burst', 1, '2 s'),   // burst: 1 vote/2s, mirrors the client cooldown (VoteScreen.tsx)
  makeLimiter('rl:vote', 20, '60 s'),        // sustained: 20/min
];
export const suggestLimiters = [
  makeLimiter('rl:suggest', 5, '15 m'),
];

// Trust the platform-resolved client IP. Reading x-forwarded-for[0] ourselves
// is wrong: that entry is client-supplied and trivially spoofed, which defeats
// any per-IP limit. @vercel/functions returns the IP Vercel's edge observed.
export function clientIp(req: Request): string {
  return ipAddress(req) ?? 'unknown';
}

// Returns true if the request should be rejected by ANY of the given limiters.
// Fails open: if Redis is unreachable we log and allow the request rather than
// 500-ing the route — a rate-limit outage shouldn't take voting down with it.
export async function isRateLimited(limiters: (Ratelimit | null)[], ip: string): Promise<boolean> {
  for (const limiter of limiters) {
    if (!limiter) continue;
    try {
      const { success } = await limiter.limit(ip);
      if (!success) return true;
    } catch (err) {
      console.error('rate limit check failed, allowing request', err);
    }
  }
  return false;
}
