import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const VOTE_SECRET = process.env.VOTE_SECRET!;

// In-memory sliding-window limiter. Per-instance only (resets on cold start and
// isn't shared across serverless instances) — enough to stop naive spam for the
// MVP. Swap for a shared store (Upstash/Redis) when running multi-instance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30; // ~1 vote / 2s, matching the client cadence
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: { winnerId?: unknown; loserId?: unknown; cohort?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { winnerId, loserId, cohort, sessionId } = body;
  if (typeof winnerId !== 'string' || typeof loserId !== 'string' || winnerId === loserId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('process_vote', {
    p_winner_id: winnerId,
    p_loser_id: loserId,
    p_cohort: typeof cohort === 'string' ? cohort : 'all',
    p_session_id: typeof sessionId === 'string' ? sessionId : null,
    p_secret: VOTE_SECRET,
  });

  if (error) {
    return NextResponse.json({ error: 'vote_failed' }, { status: 500 });
  }
  return NextResponse.json({ data });
}
