'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getSessionId } from './supabase';
import type { CompanyState, StoreState, CohortId } from './types';

const USER_VOTES_KEY = 'tierboard:userVotes';

function emptyState(): StoreState {
  return { companies: {}, totalVotes: 0, userVotes: 0, history: [], loaded: false };
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
  company_sectors: { sector_id: string }[];
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
    rank: null,
    rankPrev: null,
  };
}

export function effectiveElo(c: CompanyState, _cohort: CohortId): number {
  // Per-cohort ELO will come from cohort_elos table once votes accumulate.
  // Barebones v0: global ELO only.
  return c.elo;
}

export function pickNextPair(state: StoreState, _cohort: CohortId): [string, string] | null {
  const ids = Object.keys(state.companies);
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

export function useStore() {
  const [state, setState] = useState<StoreState>(emptyState);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, tagline, elo, starting_elo, votes, wins, losses, delta_24h, company_sectors(sector_id)')
        .order('elo', { ascending: false });

      if (cancelled) return;
      if (error) { console.error('load companies failed', error); return; }

      const companies: Record<string, CompanyState> = {};
      for (const row of (data ?? []) as CompanyRow[]) {
        companies[row.id] = rowToState(row);
      }
      recomputeRanks(companies, {});

      const totalVotes = Object.values(companies).reduce((s, c) => s + c.votes, 0) / 2;
      const userVotes = Number(localStorage.getItem(USER_VOTES_KEY) ?? 0);

      setState({ companies, totalVotes: Math.round(totalVotes), userVotes, history: [], loaded: true });
    }

    load();

    // Realtime: any company UPDATE refreshes that row in local state
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

  const vote = useCallback(async (winnerId: string, loserId: string) => {
    // Optimistic local update — realtime will reconcile from server
    setState(prev => {
      const w = prev.companies[winnerId];
      const l = prev.companies[loserId];
      if (!w || !l) return prev;
      const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
      const delta = 32 * (1 - pW);
      const prevRanks = Object.fromEntries(
        Object.values(prev.companies).map(c => [c.id, c.rank])
      );
      const companies = { ...prev.companies,
        [winnerId]: { ...w, elo: w.elo + delta, votes: w.votes + 1, wins: w.wins + 1, delta24h: w.delta24h + delta },
        [loserId]:  { ...l, elo: l.elo - delta, votes: l.votes + 1, losses: l.losses + 1, delta24h: l.delta24h - delta },
      };
      recomputeRanks(companies, prevRanks);
      const userVotes = prev.userVotes + 1;
      try { localStorage.setItem(USER_VOTES_KEY, String(userVotes)); } catch {}
      return {
        ...prev,
        companies,
        totalVotes: prev.totalVotes + 1,
        userVotes,
        history: [{ winner: winnerId, loser: loserId, delta, ts: Date.now() }, ...prev.history].slice(0, 50),
      };
    });

    const { error } = await supabase.rpc('process_vote', {
      p_winner_id:  winnerId,
      p_loser_id:   loserId,
      p_cohort:     'all',
      p_session_id: getSessionId(),
    });
    if (error) console.error('process_vote failed', error);
  }, []);

  const reset = useCallback(() => {
    // Client-side reset only — DB is the source of truth and is not wiped here.
    try { localStorage.removeItem(USER_VOTES_KEY); } catch {}
    setState(prev => ({ ...prev, userVotes: 0, history: [] }));
  }, []);

  return { state, vote, reset };
}
