'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getSessionId } from './supabase';
import type { CompanyState, StoreState, CohortId, LeaderboardId } from './types';

const USER_VOTES_KEY = 'tierboard:userVotes';

function userVotesKey(leaderboardId: LeaderboardId): string {
  return `${USER_VOTES_KEY}:${leaderboardId}`;
}

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
  elo?: number | string | null;
  starting_elo?: number | string | null;
  votes?: number | null;
  wins?: number | null;
  losses?: number | null;
  delta_24h?: number | string | null;
  company_sectors: { sector_id: string }[] | null;
}

interface StatsRow {
  company_id: string;
  elo: number | string;
  starting_elo: number | string;
  votes: number;
  wins: number;
  losses: number;
  delta_24h: number | string;
}

interface SectorRow {
  id: string;
  label: string;
  tint: string;
  fg: string;
}

function defaultStats(companyId: string): StatsRow {
  return {
    company_id: companyId,
    elo: 1500,
    starting_elo: 1500,
    votes: 0,
    wins: 0,
    losses: 0,
    delta_24h: 0,
  };
}

function legacyStats(r: CompanyRow): StatsRow {
  return {
    company_id: r.id,
    elo: r.elo ?? 1500,
    starting_elo: r.starting_elo ?? 1500,
    votes: r.votes ?? 0,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    delta_24h: r.delta_24h ?? 0,
  };
}

function rowToState(company: CompanyRow, stats: StatsRow): CompanyState {
  return {
    id: company.id,
    name: company.name,
    tagline: company.tagline,
    sectors: (company.company_sectors ?? []).map(s => s.sector_id),
    elo: Number(stats.elo),
    startingElo: Number(stats.starting_elo),
    votes: stats.votes,
    wins: stats.wins,
    losses: stats.losses,
    delta24h: Number(stats.delta_24h),
    rank: null,
    rankPrev: null,
  };
}

export function effectiveElo(c: CompanyState, _cohort: CohortId): number {
  // Per-cohort ELO will come from cohort_elos table once votes accumulate.
  // Barebones v0: selected leaderboard ELO only.
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

function applyStatsUpdate(
  prev: StoreState,
  companyId: string,
  next: Partial<StatsRow>,
): StoreState {
  const existing = prev.companies[companyId];
  if (!existing) return prev;
  const prevRanks = Object.fromEntries(
    Object.values(prev.companies).map(c => [c.id, c.rank])
  );
  const companies = { ...prev.companies };
  companies[companyId] = {
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
}

export function useStore(leaderboardId: LeaderboardId) {
  const [state, setState] = useState<StoreState>(emptyState);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...emptyState(), sectors: prev.sectors }));

    async function load() {
      const [companiesRes, statsRes, sectorsRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, tagline, elo, starting_elo, votes, wins, losses, delta_24h, company_sectors(sector_id)')
          .order('name', { ascending: true }),
        supabase
          .from('company_leaderboard_stats')
          .select('company_id, elo, starting_elo, votes, wins, losses, delta_24h')
          .eq('leaderboard_id', leaderboardId),
        supabase.from('sectors').select('id, label, tint, fg'),
      ]);

      if (cancelled) return;
      if (companiesRes.error) {
        console.error('load companies failed', companiesRes.error);
        setState(prev => ({ ...prev, loaded: true }));
        return;
      }
      if (statsRes.error) {
        console.error('load leaderboard stats failed', statsRes.error);
      }

      const statsByCompany = new Map<string, StatsRow>();
      if (!statsRes.error) {
        for (const row of (statsRes.data ?? []) as StatsRow[]) {
          statsByCompany.set(row.company_id, row);
        }
      }

      const companies: Record<string, CompanyState> = {};
      for (const row of (companiesRes.data ?? []) as CompanyRow[]) {
        const stats = statsByCompany.get(row.id)
          ?? (leaderboardId === 'prestige' ? legacyStats(row) : defaultStats(row.id));
        companies[row.id] = rowToState(row, stats);
      }
      recomputeRanks(companies, {});

      const totalVotes = Object.values(companies).reduce((s, c) => s + c.votes, 0) / 2;
      const userVotes = Number(localStorage.getItem(userVotesKey(leaderboardId)) ?? 0);
      const sectors = (sectorsRes.data ?? []) as SectorRow[];

      setState({ companies, sectors, totalVotes: Math.round(totalVotes), userVotes, history: [], loaded: true });
    }

    load();

    const channel = supabase
      .channel(`leaderboard-stream:${leaderboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_leaderboard_stats',
          filter: `leaderboard_id=eq.${leaderboardId}`,
        },
        (payload) => {
          const next = payload.new as Partial<StatsRow> & { company_id?: string };
          if (!next.company_id) return;
          setState(prev => applyStatsUpdate(prev, next.company_id!, next));
        }
      );

    if (leaderboardId === 'prestige') {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'companies' },
        (payload) => {
          const next = payload.new as Partial<StatsRow> & { id: string };
          setState(prev => applyStatsUpdate(prev, next.id, { ...next, company_id: next.id }));
        }
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [leaderboardId]);

  const vote = useCallback(async (winnerId: string, loserId: string, cohort: CohortId) => {
    // Optimistic local update - realtime will reconcile from server.
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
      try { localStorage.setItem(userVotesKey(leaderboardId), String(userVotes)); } catch {}
      return {
        ...prev,
        companies,
        totalVotes: prev.totalVotes + 1,
        userVotes,
        history: [{ winner: winnerId, loser: loserId, delta, ts: Date.now() }, ...prev.history].slice(0, 50),
      };
    });

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId,
          loserId,
          cohort,
          leaderboardId,
          sessionId: getSessionId(),
        }),
      });
      if (!res.ok) console.error('vote failed', res.status);
    } catch (e) {
      console.error('vote request failed', e);
    }
  }, [leaderboardId]);

  const reset = useCallback(() => {
    // Client-side reset only - DB is the source of truth and is not wiped here.
    try { localStorage.removeItem(userVotesKey(leaderboardId)); } catch {}
    setState(prev => ({ ...prev, userVotes: 0, history: [] }));
  }, [leaderboardId]);

  return { state, vote, reset };
}
