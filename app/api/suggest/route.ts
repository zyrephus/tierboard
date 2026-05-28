import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

// 5 suggestions per 15 minutes per IP
const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 5;
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

function hashIp(ip: string): string {
  return createHash('sha256').update(ip + (process.env.IP_HASH_SALT ?? 'tierboard')).digest('hex').slice(0, 16);
}

const VALID_SECTORS = new Set([
  'ai', 'quant', 'bigtech', 'unicorn', 'startup',
  'public', 'hardware', 'crypto', 'gaming', 'media', 'fintech', 'defense',
]);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { type, companyName, tagline, sectors, tagAction } = body;

  if (type !== 'missing_company' && type !== 'tag_edit') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof companyName !== 'string' || companyName.trim().length < 1 || companyName.trim().length > 100) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!Array.isArray(sectors) || sectors.length === 0 || sectors.length > 4) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!sectors.every((s): s is string => typeof s === 'string' && VALID_SECTORS.has(s))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (type === 'tag_edit' && tagAction !== 'add' && tagAction !== 'remove') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const cleanTagline = typeof tagline === 'string' ? tagline.trim().slice(0, 200) : null;

  const { error } = await supabase.from('suggestions').insert({
    type,
    company_name: companyName.trim(),
    tagline: cleanTagline || null,
    sectors,
    tag_action: type === 'tag_edit' ? tagAction : null,
    ip_hash: hashIp(ip),
  });

  if (error) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
