import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, isRateLimited, voteLimiter } from '@/lib/ratelimit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const VOTE_SECRET = process.env.VOTE_SECRET!;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await isRateLimited(voteLimiter, ip)) {
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
