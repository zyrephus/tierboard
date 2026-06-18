'use client';

import { useState, useCallback, useEffect } from 'react';
import { CompanyCard } from './CompanyCard';
import { useShell } from '@/components/Shell';
import type { StoreState, CompanyState, CohortId } from '@/lib/types';

interface VoteScreenProps {
  state: StoreState;
  cohort: CohortId;
}

interface LastResult {
  winner: CompanyState;
  loser: CompanyState;
  upset: boolean;
}

function SkeletonCompanyCard() {
  return (
    <div className="company-card" aria-hidden="true">
      <div className="card-top">
        <div className="skeleton" style={{ width: 72, height: 72, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 90, height: 22 }} />
      </div>
      <div className="card-mid">
        <div className="skeleton" style={{ width: '60%', height: 30, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '90%', height: 14 }} />
      </div>
      <div className="card-bottom">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="card-stat" key={i}>
            <div className="skeleton" style={{ width: 28, height: 9, marginBottom: 5 }} />
            <div className="skeleton" style={{ width: 40, height: 18 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VoteScreen({ state, cohort }: VoteScreenProps) {
  // The matchup and gauntlet state are held in Shell so they persist across navigation.
  // VoteScreen only owns the transient interaction state (picked highlight, cooldown).
  const { votePair: pair, nextVotePair, onVotePick, gauntlet } = useShell();
  const [picked, setPicked] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  // Clear the picked highlight whenever the matchup changes (next / cohort swap).
  // Cooldown is left to its own 2s timer so the input lock isn't cut short.
  useEffect(() => { setPicked(null); }, [pair]);

  const onPick = useCallback((winnerId: string) => {
    if (picked || cooldown || !pair) return;
    const loserId = pair[0] === winnerId ? pair[1] : pair[0];
    const w = state.companies[winnerId], l = state.companies[loserId];
    // Upset = winner had less than 40% win probability based on current Points
    const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
    setPicked(winnerId);
    setCooldown(true);
    setLastResult({ winner: w, loser: l, upset: pW < 0.4 });
    // Smooth transition to the next pair, but input stays locked for 2s.
    setTimeout(() => { onVotePick(winnerId); }, 380);
    setTimeout(() => setCooldown(false), 2000);
  }, [pair, picked, cooldown, state, onVotePick]);

  const onSkip = useCallback(() => {
    if (picked || cooldown) return;
    setLastResult(null);
    nextVotePair();
  }, [picked, cooldown, nextVotePair]);

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

  const champion = gauntlet.championId ? state.companies[gauntlet.championId] : null;

  if (!pair) {
    return (
      <div className="vote-screen">
        <div className="vote-header">
          <h1 className="vote-prompt">Would you rather work at</h1>
          <div className="vote-meta">
            <div className="meta-stat">
              <span className="skeleton" style={{ width: 48, height: 22 }} />
              <span className="meta-label">your votes</span>
            </div>
            <div className="meta-stat">
              <span className="skeleton" style={{ width: 64, height: 22 }} />
              <span className="meta-label">total votes</span>
            </div>
          </div>
        </div>
        <div className="matchup">
          <SkeletonCompanyCard />
          <div className="versus">
            <div className="versus-line" />
            <div className="versus-text">VS</div>
            <div className="versus-line" />
          </div>
          <SkeletonCompanyCard />
        </div>
      </div>
    );
  }
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
          {champion && gauntlet.streak > 0 && (
            <div className="meta-stat meta-streak" aria-label={`${champion.name} is reigning champion with ${gauntlet.streak} wins`}>
              <span className="meta-num streak-num">♛ {gauntlet.streak}-0</span>
              <span className="meta-label">{champion.name} reigning</span>
            </div>
          )}
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
          isChampion={gauntlet.championId === aId}
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
          isChampion={gauntlet.championId === bId}
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
              <span className="result-sep">·</span>
              <span className="result-counted">Vote counted · rankings update hourly</span>
              {lastResult.upset && <span className="result-upset">UPSET</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
