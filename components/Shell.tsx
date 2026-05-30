'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { SectorsProvider } from '@/lib/sectors-context';
import { CohortPicker } from './CohortPicker';
import type { CohortId, StoreState } from '@/lib/types';

interface ShellValue {
  state: StoreState;
  vote: (winnerId: string, loserId: string) => void;
  cohort: CohortId;
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

  const recentVote = state.history[0];

  return (
    <SectorsProvider sectors={state.sectors}>
    <ShellContext.Provider value={{ state, vote, cohort }}>
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
