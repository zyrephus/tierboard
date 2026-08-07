'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, pickNextPair, pickFreshPair, pickChallenger } from '@/lib/store';
import { SectorsProvider } from '@/lib/sectors-context';
import { CohortPicker } from './CohortPicker';
import { advanceGauntlet, skipGauntlet } from '@/lib/gauntlet';
import type { GauntletState } from '@/lib/gauntlet';
import type { CohortId, StoreState } from '@/lib/types';
import type { RangeKey } from '@/lib/chart';
import type { VoteSource } from '@/lib/gauntlet';

interface ShellValue {
  state: StoreState;
  vote: (winnerId: string, loserId: string, source?: VoteSource) => void;
  cohort: CohortId;
  // Persistent view state — survives route navigation because Shell lives in
  // the root layout and never unmounts. Screens read these instead of
  // re-deriving on mount, so the matchup, chart selection, and reveal animation
  // don't reset every time you switch tabs.
  votePair: [string, string] | null;
  nextVotePair: () => void;
  onVotePick: (winnerId: string) => void;
  gauntlet: GauntletState;
  chartSelected: string[] | null;
  setChartSelected: (ids: string[]) => void;
  chartRange: RangeKey;
  setChartRange: (r: RangeKey) => void;
  leaderboardRevealed: boolean;
  markLeaderboardRevealed: () => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used within Shell');
  return value;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, vote } = useStore();
  const [cohort, setCohort] = useState<CohortId>('all');
  const pathname = usePathname();

  // ── Persistent view state (see ShellValue) ──────────────────────────────
  const [votePair, setVotePair] = useState<[string, string] | null>(null);
  const [gauntlet, setGauntlet] = useState<GauntletState>({ championId: null, streak: 0 });
  const [chartSelected, setChartSelected] = useState<string[] | null>(null);
  const [chartRange, setChartRange] = useState<RangeKey>('1D');
  const [leaderboardRevealed, setLeaderboardRevealed] = useState(false);

  // Recently-shown company ids (most recent first) so the same companies don't
  // reappear a few rounds later. Kept in a ref so it doesn't trigger re-renders
  // and selection callbacks always read the latest value.
  const seenRef = useRef<string[]>([]);
  const RECENT_CAP = 12;
  const pushSeen = useCallback((...ids: (string | null | undefined)[]) => {
    const next = [...ids.filter((x): x is string => !!x), ...seenRef.current];
    seenRef.current = Array.from(new Set(next)).slice(0, RECENT_CAP);
  }, []);

  // Skip: draw fresh pair, no champion carried, avoiding recently-seen companies.
  const nextVotePair = useCallback(() => {
    const transition = skipGauntlet();
    setGauntlet({ championId: transition.champion, streak: transition.streak });
    const pair = pickFreshPair(state, cohort, seenRef.current);
    setVotePair(pair);
    if (pair) pushSeen(pair[0], pair[1]);
  }, [state, cohort, pushSeen]);

  const markLeaderboardRevealed = useCallback(() => setLeaderboardRevealed(true), []);

  // Called by VoteScreen after a pick — advances gauntlet then sets next pair.
  const onVotePick = useCallback((winnerId: string) => {
    if (!votePair) return;
    const transition = advanceGauntlet(gauntlet, winnerId, votePair);
    vote(winnerId, votePair[0] === winnerId ? votePair[1] : votePair[0], transition.source);

    setGauntlet({ championId: transition.champion, streak: transition.streak });

    if (transition.champion === null) {
      // Retire or fresh draw — exclude the just-retired champion + recently seen.
      const pair = pickFreshPair(state, cohort, [transition.excludeId, ...seenRef.current]);
      setVotePair(pair);
      if (pair) pushSeen(pair[0], pair[1]);
    } else {
      // Champion continues. Keep the reigning card on the SAME side it just won
      // on (king of the hill stays put); the new challenger takes the other slot.
      const challengerId = pickChallenger(transition.champion, state, cohort, seenRef.current);
      if (challengerId) {
        const champOnLeft = votePair[0] === transition.champion;
        const pair: [string, string] = champOnLeft
          ? [transition.champion, challengerId]
          : [challengerId, transition.champion];
        setVotePair(pair);
        pushSeen(transition.champion, challengerId);
      } else {
        const pair = pickFreshPair(state, cohort, seenRef.current);
        setVotePair(pair);
        if (pair) pushSeen(pair[0], pair[1]);
      }
    }
  }, [votePair, gauntlet, vote, state, cohort, pushSeen]);

  // Pick the first matchup once data loads, then keep it across navigation.
  useEffect(() => {
    if (!state.loaded) return;
    setVotePair(prev => {
      if (prev) return prev;
      // Use the pair picked at load time (its logos are already preloaded);
      // fall back to a fresh pick only if it's somehow missing.
      const pair = state.initialPair ?? pickNextPair(state, cohort);
      seenRef.current = pair ? [pair[0], pair[1]] : [];
      return pair;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded]);

  // Re-pick only when the cohort actually changes, not on the initial mount.
  const firstCohort = useRef(true);
  useEffect(() => {
    if (firstCohort.current) { firstCohort.current = false; return; }
    setGauntlet({ championId: null, streak: 0 });
    const pair = pickNextPair(state, cohort);
    seenRef.current = pair ? [pair[0], pair[1]] : [];
    setVotePair(pair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort]);

  const recentVote = state.history[0];

  return (
    <SectorsProvider sectors={state.sectors}>
    <ShellContext.Provider value={{
      state, vote, cohort,
      votePair, nextVotePair, onVotePick, gauntlet,
      chartSelected, setChartSelected,
      chartRange, setChartRange,
      leaderboardRevealed, markLeaderboardRevealed,
    }}>
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-mark-inner" />
          </div>
          <span className="brand-name">TierBoard</span>
          <span className="brand-tag">/ tech prestige, voted</span>
        </div>
        <nav className="tabs">
          <Link href="/" className={`tab ${pathname === '/' ? 'active' : ''}`}>
            <span className="tab-num">00</span>
            <span>Vote</span>
          </Link>
          <Link href="/board" className={`tab ${pathname === '/board' ? 'active' : ''}`}>
            <span className="tab-num">01</span>
            <span>Board</span>
          </Link>
          <Link href="/chart" className={`tab ${pathname === '/chart' ? 'active' : ''}`}>
            <span className="tab-num">02</span>
            <span>Chart</span>
          </Link>
        </nav>
        <div className="topbar-right">
          <CohortPicker cohort={cohort} setCohort={setCohort} />
        </div>
      </header>

      {/* Main content */}
      <main className="main">{children}</main>

      {/* Status bar */}
      <footer className="statusbar">
        <div className="status-left">
          <span className="status-dot" />
          <span>LIVE</span>
          <span className="dot">·</span>
          <span>{state.totalVotes.toLocaleString()} votes</span>
          <span className="dot">·</span>
          <span>{Object.keys(state.companies).length} companies</span>
        </div>
        <div className="status-right">
          {recentVote ? (
            <span>
              last: <strong>{state.companies[recentVote.winner]?.name}</strong>
              {' ›'} {state.companies[recentVote.loser]?.name}
            </span>
          ) : (
            <span>vote a few matchups to begin</span>
          )}
        </div>
      </footer>
    </div>
    </ShellContext.Provider>
    </SectorsProvider>
  );
}
