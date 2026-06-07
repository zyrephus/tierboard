'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getSessionId } from './supabase';
import type { CompanyState, StoreState, CohortId } from './types';
import type { VoteSource } from './gauntlet';

const USER_VOTES_KEY = 'tierboard:userVotes';

function emptyState(): StoreState {
  return { companies: {}, sectors: [], totalVotes: 0, userVotes: 0, history: [], loaded: false };
}

function recomputeRanks(companies: Record<string, CompanyState>, prevRanks: Record<string, number | null>) {
  const sorted = Object.values(companies).sort((a, b) => b.elo - a.elo);
  sorted.forEach((c, i) => {
    companies[c.id] = { ...c, rank: i + 1, rankPrev: prevRanks[c.id] ?? i + 1 };
  });
}

interface CompanyRow {
  id: string;
  name: string;
  tagline: string;
  elo: number;
  starting_elo: number;
  votes: number;
  wins: number;
  losses: number;
  delta_24h: number;
  logo_url: string | null;
  games: number;
  index_se: number | null;
  company_sectors: { sector_id: string }[];
}

// Preload logo images so rows reveal with their logos already painted (no pop-in).
// Capped by a timeout so a slow/broken image never blocks the initial render.
function preloadImages(urls: string[], timeoutMs = 2000): Promise<void> {
  if (urls.length === 0) return Promise.resolve();
  return new Promise(resolve => {
    let remaining = urls.length;
    const done = () => { if (--remaining <= 0) resolve(); };
    setTimeout(resolve, timeoutMs);
    for (const url of urls) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = url;
    }
  });
}

function rowToState(r: CompanyRow): CompanyState {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    sectors: (r.company_sectors ?? []).map(s => s.sector_id),
    elo: Number(r.elo),
    startingElo: Number(r.starting_elo),
    votes: r.votes,
    wins: r.wins,
    losses: r.losses,
    delta24h: Number(r.delta_24h),
    logoUrl: r.logo_url,
    games: r.games ?? 0,
    indexSe: r.index_se != null ? Number(r.index_se) : undefined,
    rank: null,
    rankPrev: null,
  };
}

export function effectiveElo(c: CompanyState, _cohort: CohortId): number {
  // Per-cohort ELO will come from cohort_elos table once votes accumulate.
  // Barebones v0: global ELO only.
  return c.elo;
}

/**
 * Pick a fresh random pair, optionally excluding a specific company id.
 * Uses close-elo + under-sampled weighting heuristic.
 */
export function pickFreshPair(state: StoreState, _cohort: CohortId, excludeId?: string | null): [string, string] | null {
  const ids = Object.keys(state.companies).filter(id => id !== excludeId);
  if (ids.length < 2) return null;
  let best: [string, string] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    if (a === b) continue;
    const ca = state.companies[a], cb = state.companies[b];
    const diff = Math.abs(ca.elo - cb.elo);
    const undervote = -(ca.votes + cb.votes) * 0.5;
    const score = -diff + undervote + Math.random() * 200;
    if (score > bestScore) { bestScore = score; best = [a, b]; }
  }
  return best;
}

/**
 * Pick a challenger for an existing champion.
 * Never returns the champion or excludeId.
 */
export function pickChallenger(championId: string, state: StoreState, _cohort: CohortId, excludeId?: string | null): string | null {
  const champion = state.companies[championId];
  if (!champion) return null;
  const ids = Object.keys(state.companies).filter(id => id !== championId && id !== excludeId);
  if (ids.length === 0) return null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const c = state.companies[id];
    const diff = Math.abs(champion.elo - c.elo);
    const undervote = -(champion.votes + c.votes) * 0.5;
    const score = -diff + undervote + Math.random() * 200;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

// Kept for backward compatibility — delegates to pickFreshPair.
export function pickNextPair(state: StoreState, cohort: CohortId): [string, string] | null {
  return pickFreshPair(state, cohort);
}

export function useStore() {
  const [state, setState] = useState<StoreState>(emptyState);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [companiesRes, sectorsRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, tagline, logo_url, elo, starting_elo, votes, wins, losses, delta_24h, games, index_se, company_sectors(sector_id)')
          .order('elo', { ascending: false }),
        supabase.from('sectors').select('id, label, tint, fg'),
      ]);

      if (cancelled) return;
      if (companiesRes.error) { console.error('load companies failed', companiesRes.error); return; }

      const companies: Record<string, CompanyState> = {};
      for (const row of (companiesRes.data ?? []) as CompanyRow[]) {
        companies[row.id] = rowToState(row);
      }
      recomputeRanks(companies, {});

      const totalVotes = Object.values(companies).reduce((s, c) => s + c.votes, 0) / 2;
      const userVotes = Number(localStorage.getItem(USER_VOTES_KEY) ?? 0);
      const sectors = (sectorsRes.data ?? []) as { id: string; label: string; tint: string; fg: string }[];

      const logoUrls = Object.values(companies)
        .map(c => c.logoUrl)
        .filter((u): u is string => !!u);
      await preloadImages(logoUrls);
      if (cancelled) return;

      setState({ companies, sectors, totalVotes: Math.round(totalVotes), userVotes, history: [], loaded: true });
    }

    load();

    // Realtime: any company UPDATE refreshes that row in local state.
    // IMPORTANT: this handler only updates display data — it must NOT reset gauntlet
    // state in Shell. Champion identity is keyed by id in Shell, so only ratings refresh.
    const channel = supabase
      .channel('companies-stream')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'companies' },
        (payload) => {
          const next = payload.new as Partial<CompanyRow> & { id: string };
          setState(prev => {
            const existing = prev.companies[next.id];
            if (!existing) return prev;
            const prevRanks = Object.fromEntries(
              Object.values(prev.companies).map(c => [c.id, c.rank])
            );
            const companies = { ...prev.companies };
            companies[next.id] = {
              ...existing,
              elo:       next.elo       != null ? Number(next.elo)       : existing.elo,
              votes:     next.votes     != null ? next.votes             : existing.votes,
              wins:      next.wins      != null ? next.wins              : existing.wins,
              losses:    next.losses    != null ? next.losses            : existing.losses,
              delta24h:  next.delta_24h != null ? Number(next.delta_24h) : existing.delta24h,
              games:     next.games     != null ? next.games             : existing.games,
              indexSe:   next.index_se  != null ? Number(next.index_se)  : existing.indexSe,
            };
            recomputeRanks(companies, prevRanks);
            const totalVotes = Math.round(
              Object.values(companies).reduce((s, c) => s + c.votes, 0) / 2
            );
            return { ...prev, companies, totalVotes };
          });
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, []);

  const vote = useCallback(async (winnerId: string, loserId: string, source?: VoteSource) => {
    // Local feedback only. The board no longer moves per vote — companies.elo is
    // recomputed hourly from the vote log (recompute_rankings), and the realtime
    // subscription delivers that batch.
    setState(prev => {
      const w = prev.companies[winnerId];
      const l = prev.companies[loserId];
      if (!w || !l) return prev;
      const userVotes = prev.userVotes + 1;
      try { localStorage.setItem(USER_VOTES_KEY, String(userVotes)); } catch {}
      return {
        ...prev,
        totalVotes: prev.totalVotes + 1,
        userVotes,
        history: [{ winner: winnerId, loser: loserId, delta: 0, ts: Date.now() }, ...prev.history].slice(0, 50),
      };
    });

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId,
          loserId,
          cohort: 'all',
          sessionId: getSessionId(),
          source: source ?? null,
        }),
      });
      if (!res.ok) console.error('vote failed', res.status);
    } catch (e) {
      console.error('vote request failed', e);
    }
  }, []);

  const reset = useCallback(() => {
    // Client-side reset only — DB is the source of truth and is not wiped here.
    try { localStorage.removeItem(USER_VOTES_KEY); } catch {}
    setState(prev => ({ ...prev, userVotes: 0, history: [] }));
  }, []);

  return { state, vote, reset };
}
