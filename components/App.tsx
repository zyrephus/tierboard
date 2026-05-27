'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { COHORTS } from '@/lib/data';
import { VoteScreen } from './VoteScreen';
import { Leaderboard } from './Leaderboard';
import {
  TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakButton, useTweaks,
} from './TweaksPanel';
import type { CohortId } from '@/lib/types';

const TWEAK_DEFAULTS = {
  accent: '#7c3aed',
  density: 'comfortable',
};

const ACCENT_OPTIONS = ['#7c3aed', '#1f1f1f', '#2563eb', '#16a34a', '#dc2626'];

function hexToAccentOklch(hex: string) {
  const map: Record<string, { hue: number; mono: boolean }> = {
    '#7c3aed': { hue: 290, mono: false },
    '#1f1f1f': { hue: 290, mono: true },
    '#2563eb': { hue: 250, mono: false },
    '#16a34a': { hue: 145, mono: false },
    '#dc2626': { hue: 25,  mono: false },
  };
  return map[hex.toLowerCase()] ?? { hue: 290, mono: false };
}

type Tab = 'vote' | 'leaderboard';

export function App() {
  const { state, vote, reset } = useStore();
  const [tab, setTab] = useState<Tab>('vote');
  const [cohort, setCohort] = useState<CohortId>('all');
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply accent to :root CSS variables
  useEffect(() => {
    const a = hexToAccentOklch(tweaks.accent);
    const root = document.documentElement;
    if (a.mono) {
      root.style.setProperty('--accent',      'oklch(0.22 0.01 290)');
      root.style.setProperty('--accent-bg',   'oklch(0.96 0.005 290)');
      root.style.setProperty('--accent-text', 'oklch(0.22 0.01 290)');
      root.style.setProperty('--accent-soft', 'oklch(0.9 0.01 290)');
    } else {
      root.style.setProperty('--accent',      `oklch(0.5 0.18 ${a.hue})`);
      root.style.setProperty('--accent-bg',   `oklch(0.97 0.03 ${a.hue})`);
      root.style.setProperty('--accent-text', `oklch(0.4 0.15 ${a.hue})`);
      root.style.setProperty('--accent-soft', `oklch(0.85 0.07 ${a.hue})`);
    }
    root.dataset.density = tweaks.density;
  }, [tweaks.accent, tweaks.density]);

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
          <button
            className="tweaks-toggle"
            onClick={() => setTweaksOpen(o => !o)}
            title="Tweaks"
            aria-label="Toggle tweaks panel"
          >
            ⚙
          </button>
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
          <span>150 companies</span>
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

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks" open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Accent">
          <TweakColor
            label="Color"
            value={tweaks.accent}
            options={ACCENT_OPTIONS}
            onChange={v => setTweak('accent', v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfy' }]}
            onChange={v => setTweak('density', v)}
          />
        </TweakSection>
        <TweakSection label="Data">
          <TweakButton label="Reset all votes" onClick={() => {
            if (confirm('Reset all votes and ELOs?')) reset();
          }} />
        </TweakSection>
        <TweakSection label="Stats">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <div>your votes: {state.userVotes}</div>
            <div>total simulated: {state.totalVotes.toLocaleString()}</div>
            <div>recent history: {state.history.length}</div>
          </div>
        </TweakSection>
      </TweaksPanel>
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
