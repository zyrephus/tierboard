'use client';

import { useState, useEffect, useCallback } from 'react';
import { COMPANIES } from './data';
import type { CompanyState, StoreState, CohortId } from './types';

const STORE_KEY = 'tierboard:v3';
const K_FACTOR = 32;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function applyVoteMut(
  companies: Record<string, CompanyState>,
  winnerId: string,
  loserId: string,
  kMult = 1,
  trackDelta = false,
): number | null {
  const w = companies[winnerId];
  const l = companies[loserId];
  if (!w || !l) return null;
  const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
  const delta = K_FACTOR * kMult * (1 - pW);
  w.elo += delta;
  l.elo -= delta;
  w.votes++;
  l.votes++;
  w.wins++;
  l.losses++;
  if (trackDelta) {
    w.delta24h = (w.delta24h || 0) + delta;
    l.delta24h = (l.delta24h || 0) - delta;
  }
  return delta;
}

function buildInitialState(): StoreState {
  const companies: Record<string, CompanyState> = {};
  for (const c of COMPANIES) {
    companies[c.id] = {
      ...c,
      elo: c.startingElo,
      votes: 0,
      wins: 0,
      losses: 0,
      delta24h: 0,
      rankPrev: null,
      rank: null,
    };
  }

  const ids = Object.keys(companies);
  const rng = mulberry32(1337);

  // Pre-simulate votes for a live-looking baseline
  for (let i = 0; i < 2400; i++) {
    const a = ids[Math.floor(rng() * ids.length)];
    const b = ids[Math.floor(rng() * ids.length)];
    if (a === b) continue;
    const ca = companies[a], cb = companies[b];
    const pA = 1 / (1 + Math.pow(10, (cb.elo - ca.elo) / 400));
    const winner = rng() < pA ? a : b;
    applyVoteMut(companies, winner, winner === a ? b : a, 0.4);
  }

  const sorted = Object.values(companies).sort((x, y) => y.elo - x.elo);
  sorted.forEach((c, i) => { c.rank = i + 1; c.rankPrev = i + 1; });

  // Simulate last 24h for trend arrows
  for (let i = 0; i < 600; i++) {
    const a = ids[Math.floor(rng() * ids.length)];
    const b = ids[Math.floor(rng() * ids.length)];
    if (a === b) continue;
    const ca = companies[a], cb = companies[b];
    const pA = 1 / (1 + Math.pow(10, (cb.elo - ca.elo) / 400));
    const winner = rng() < pA * 0.9 + 0.05 ? a : b;
    applyVoteMut(companies, winner, winner === a ? b : a, 1, true);
  }

  const sorted2 = Object.values(companies).sort((x, y) => y.elo - x.elo);
  sorted2.forEach((c, i) => { c.rank = i + 1; });

  return { companies, totalVotes: 0, userVotes: 0, history: [] };
}

export function effectiveElo(c: CompanyState, cohort: CohortId): number {
  if (cohort === 'all') return c.elo;
  const bias = c.cohortBias?.[cohort] || 0;
  return c.elo + bias;
}

export function pickNextPair(state: StoreState, cohort: CohortId): [string, string] | null {
  const ids = Object.keys(state.companies);
  let best: [string, string] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    if (a === b) continue;
    const ca = state.companies[a], cb = state.companies[b];
    const eloA = effectiveElo(ca, cohort), eloB = effectiveElo(cb, cohort);
    const diff = Math.abs(eloA - eloB);
    const undervote = -(ca.votes + cb.votes) * 0.5;
    const score = -diff + undervote + Math.random() * 200;
    if (score > bestScore) { bestScore = score; best = [a, b]; }
  }
  return best;
}

export function useStore() {
  const [state, setState] = useState<StoreState>(() => {
    if (typeof window === 'undefined') return buildInitialState();
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = buildInitialState();
        for (const id of Object.keys(parsed.companies || {})) {
          if (fresh.companies[id]) {
            fresh.companies[id].elo = parsed.companies[id].elo;
            fresh.companies[id].votes = parsed.companies[id].votes;
            fresh.companies[id].wins = parsed.companies[id].wins;
            fresh.companies[id].losses = parsed.companies[id].losses;
            fresh.companies[id].delta24h = parsed.companies[id].delta24h || 0;
          }
        }
        fresh.totalVotes = parsed.totalVotes || 0;
        fresh.userVotes = parsed.userVotes || 0;
        fresh.history = parsed.history || [];
        const sorted = Object.values(fresh.companies).sort((x, y) => y.elo - x.elo);
        sorted.forEach((c, i) => { c.rank = i + 1; });
        return fresh;
      }
    } catch (e) {
      console.warn('store load failed', e);
    }
    return buildInitialState();
  });

  useEffect(() => {
    const slim = {
      companies: Object.fromEntries(
        Object.entries(state.companies).map(([k, v]) => [
          k,
          { elo: v.elo, votes: v.votes, wins: v.wins, losses: v.losses, delta24h: v.delta24h },
        ]),
      ),
      totalVotes: state.totalVotes,
      userVotes: state.userVotes,
      history: state.history.slice(0, 50),
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(slim)); } catch {}
  }, [state]);

  const vote = useCallback((winnerId: string, loserId: string) => {
    setState(prev => {
      const companies = { ...prev.companies };
      const w = { ...companies[winnerId] };
      const l = { ...companies[loserId] };
      const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
      const delta = K_FACTOR * (1 - pW);
      w.elo += delta; l.elo -= delta;
      w.votes++; l.votes++; w.wins++; l.losses++;
      w.delta24h = (w.delta24h || 0) + delta;
      l.delta24h = (l.delta24h || 0) - delta;
      companies[winnerId] = w;
      companies[loserId] = l;
      const oldRanks = Object.fromEntries(Object.values(prev.companies).map(c => [c.id, c.rank]));
      const sorted = Object.values(companies).sort((x, y) => y.elo - x.elo);
      sorted.forEach((c, i) => {
        companies[c.id] = { ...companies[c.id], rank: i + 1, rankPrev: oldRanks[c.id] ?? (i + 1) };
      });
      return {
        ...prev,
        companies,
        totalVotes: prev.totalVotes + 1,
        userVotes: prev.userVotes + 1,
        history: [{ winner: winnerId, loser: loserId, delta, ts: Date.now() }, ...prev.history].slice(0, 50),
      };
    });
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem(STORE_KEY);
    setState(buildInitialState());
  }, []);

  return { state, vote, reset };
}
