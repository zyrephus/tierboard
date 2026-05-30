'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, pickNextPair } from '@/lib/store';
import { SectorsProvider } from '@/lib/sectors-context';
import { CohortPicker } from './CohortPicker';
import type { CohortId, StoreState } from '@/lib/types';
import type { RangeKey } from '@/lib/chart';

interface ShellValue {
  state: StoreState;
  vote: (winnerId: string, loserId: string) => void;
  cohort: CohortId;
  // Persistent view state — survives route navigation because Shell lives in
  // the root layout and never unmounts. Screens read these instead of
  // re-deriving on mount, so the matchup, chart selection, and reveal animation
  // don't reset every time you switch tabs.
  votePair: [string, string] | null;
  nextVotePair: () => void;
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
  const [chartSelected, setChartSelected] = useState<string[] | null>(null);
  const [chartRange, setChartRange] = useState<RangeKey>('1D');
  const [leaderboardRevealed, setLeaderboardRevealed] = useState(false);

  const nextVotePair = useCallback(() => {
    setVotePair(pickNextPair(state, cohort));
  }, [state, cohort]);
  const markLeaderboardRevealed = useCallback(() => setLeaderboardRevealed(true), []);

  // Pick the first matchup once data loads, then keep it across navigation.
  useEffect(() => {
    if (state.loaded) setVotePair(prev => prev ?? pickNextPair(state, cohort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded]);

  // Re-pick only when the cohort actually changes, not on the initial mount.
  const firstCohort = useRef(true);
  useEffect(() => {
    if (firstCohort.current) { firstCohort.current = false; return; }
    setVotePair(pickNextPair(state, cohort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort]);

  const recentVote = state.history[0];

  return (
    <SectorsProvider sectors={state.sectors}>
    <ShellContext.Provider value={{
      state, vote, cohort,
      votePair, nextVotePair,
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
            <span>Leaderboard</span>
          </Link>
          <Link href="/vote" className={`tab ${pathname === '/vote' ? 'active' : ''}`}>
            <span className="tab-num">01</span>
            <span>Vote</span>
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
          <span className="dot">·</span>
          <span>ELO k=32</span>
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
