'use client';

import { useState, useCallback, useEffect } from 'react';
import { CompanyCard } from './CompanyCard';
import { pickNextPair } from '@/lib/store';
import type { StoreState, CompanyState, CohortId } from '@/lib/types';

interface VoteScreenProps {
  state: StoreState;
  vote: (winnerId: string, loserId: string) => void;
  cohort: CohortId;
}

interface LastResult {
  winner: CompanyState;
  loser: CompanyState;
  delta: number;
  upset: boolean;
}

export function VoteScreen({ state, vote, cohort }: VoteScreenProps) {
  const [pair, setPair] = useState<[string, string] | null>(() => pickNextPair(state, cohort));
  const [picked, setPicked] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  useEffect(() => {
    setPair(pickNextPair(state, cohort));
    setPicked(null);
    setCooldown(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort]);

  useEffect(() => {
    if (state.loaded) {
      setPair(pickNextPair(state, cohort));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded]);

  const next = useCallback(() => {
    setPicked(null);
    setPair(pickNextPair(state, cohort));
  }, [state, cohort]);

  const onPick = useCallback((winnerId: string) => {
    if (picked || cooldown || !pair) return;
    const loserId = pair[0] === winnerId ? pair[1] : pair[0];
    const w = state.companies[winnerId], l = state.companies[loserId];
    const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
    const delta = 32 * (1 - pW);
    setPicked(winnerId);
    setCooldown(true);
    setLastResult({ winner: w, loser: l, delta, upset: pW < 0.4 });
    // Smooth transition to the next pair, but input stays locked for 2s.
    setTimeout(() => { vote(winnerId, loserId); next(); }, 380);
    setTimeout(() => setCooldown(false), 2000);
  }, [pair, picked, cooldown, state, vote, next]);

  const onSkip = useCallback(() => {
    if (picked || cooldown) return;
    setLastResult(null);
    next();
  }, [picked, cooldown, next]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === '1' || e.key === 'a') { e.preventDefault(); pair && onPick(pair[0]); }
      else if (e.key === 'ArrowRight' || e.key === '2' || e.key === 'l') { e.preventDefault(); pair && onPick(pair[1]); }
      else if (e.key === ' ' || e.key === 's') { e.preventDefault(); onSkip(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pair, onPick, onSkip]);

  if (!pair) return null;
  const [aId, bId] = pair;
  const a = state.companies[aId];
  const b = state.companies[bId];

  return (
    <div className="vote-screen">
      <div className="vote-header">
        <h1 className="vote-prompt">Would you rather work at</h1>
        <div className="vote-meta">
          <div className="meta-stat">
            <span className="meta-num">{state.userVotes.toString().padStart(3, '0')}</span>
            <span className="meta-label">your votes</span>
          </div>
          <div className="meta-stat">
            <span className="meta-num">{state.totalVotes.toLocaleString()}</span>
            <span className="meta-label">total votes</span>
          </div>
        </div>
      </div>

      <div className="matchup">
        <CompanyCard
          company={a}
          cohort={cohort}
          side="left"
          onClick={() => onPick(aId)}
          picked={picked === aId}
          dimmed={!!picked && picked !== aId}
        />
        <div className="versus">
          <div className="versus-line" />
          <div className="versus-text">VS</div>
          <div className="versus-line" />
        </div>
        <CompanyCard
          company={b}
          cohort={cohort}
          side="right"
          onClick={() => onPick(bId)}
          picked={picked === bId}
          dimmed={!!picked && picked !== bId}
        />
      </div>

      <div className="vote-footer">
        <div className="footer-keys">
          <span className="key-hint"><kbd>←</kbd><span>pick</span></span>
          <span className="key-hint" onClick={!(picked || cooldown) ? onSkip : undefined} style={(picked || cooldown) ? {opacity: 0.4} : {cursor: 'pointer'}}><kbd>space</kbd><span>skip</span></span>
          <span className="key-hint"><kbd>→</kbd><span>pick</span></span>
        </div>
        <div className="vote-result">
          {lastResult && (
            <span className="result-line">
              <span className="result-arrow">↗</span>
              <strong>{lastResult.winner.name}</strong>
              <span className="result-delta">+{lastResult.delta.toFixed(1)}</span>
              <span className="result-sep">·</span>
              <span>{lastResult.loser.name}</span>
              <span className="result-delta down">−{lastResult.delta.toFixed(1)}</span>
              {lastResult.upset && <span className="result-upset">UPSET</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
