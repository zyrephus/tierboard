'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { SectorsProvider } from '@/lib/sectors-context';
import { VoteScreen } from './vote/VoteScreen';
import { Leaderboard } from './leaderboard/Leaderboard';
import { CohortPicker } from './CohortPicker';
import type { CohortId } from '@/lib/types';

type Tab = 'vote' | 'leaderboard';

export function App() {
  const { state, vote, reset } = useStore();
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [cohort, setCohort] = useState<CohortId>('all');

  const recentVote = state.history[0];

  return (
    <SectorsProvider sectors={state.sectors}>
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
          <button className={`tab ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
            <span className="tab-num">01</span>
            <span>Leaderboard</span>
          </button>
          <button className={`tab ${tab === 'vote' ? 'active' : ''}`} onClick={() => setTab('vote')}>
            <span className="tab-num">02</span>
            <span>Vote</span>
          </button>
        </nav>
        <div className="topbar-right">
          <CohortPicker cohort={cohort} setCohort={setCohort} />
        </div>
      </header>

      {/* Main content */}
      <main className="main">
        {tab === 'vote' && <VoteScreen state={state} vote={vote} cohort={cohort} />}
        {tab === 'leaderboard' && <Leaderboard state={state} cohort={cohort} />}
      </main>

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
    </SectorsProvider>
  );
}
