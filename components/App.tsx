'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { COHORTS } from '@/lib/data';
import { VoteScreen } from './VoteScreen';
import { Leaderboard } from './Leaderboard';
import type { CohortId } from '@/lib/types';

type Tab = 'vote' | 'leaderboard';

export function App() {
  const { state, vote, reset } = useStore();
  const [tab, setTab] = useState<Tab>('vote');
  const [cohort, setCohort] = useState<CohortId>('all');

  const recentVote = state.history[0];

  return (
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
          <button className={`tab ${tab === 'vote' ? 'active' : ''}`} onClick={() => setTab('vote')}>
            <span className="tab-num">01</span>
            <span>Vote</span>
          </button>
          <button className={`tab ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
            <span className="tab-num">02</span>
            <span>Leaderboard</span>
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
  );
}

function CohortPicker({ cohort, setCohort }: { cohort: CohortId; setCohort: (c: CohortId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = COHORTS.find(c => c.id === cohort);
  return (
    <div className="cohort-picker" ref={ref}>
      <button className="cohort-btn" onClick={() => setOpen(o => !o)}>
        <span className="cohort-label">COHORT</span>
        <span className="cohort-value">{current?.label}</span>
        <span className="cohort-chev">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cohort-menu">
          {COHORTS.map(c => (
            <button
              key={c.id}
              className={`cohort-opt ${c.id === cohort ? 'active' : ''}`}
              onClick={() => { setCohort(c.id as CohortId); setOpen(false); }}
            >
              <span>{c.label}</span>
              {c.id === cohort && <span className="cohort-check">✓</span>}
            </button>
          ))}
          <div className="cohort-foot">Rankings shift to match each cohort&apos;s preferences.</div>
        </div>
      )}
    </div>
  );
}
