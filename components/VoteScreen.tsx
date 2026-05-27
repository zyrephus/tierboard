'use client';

import { useState, useCallback, useEffect } from 'react';
import { Logo, SectorPill } from './Logo';
import { effectiveElo, pickNextPair } from '@/lib/store';
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
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setPair(pickNextPair(state, cohort));
    setPicked(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort]);

  const next = useCallback(() => {
    setPicked(null);
    setPair(pickNextPair(state, cohort));
  }, [state, cohort]);

  const onPick = useCallback((winnerId: string) => {
    if (picked || !pair) return;
    const loserId = pair[0] === winnerId ? pair[1] : pair[0];
    const w = state.companies[winnerId], l = state.companies[loserId];
    const pW = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
    const delta = 32 * (1 - pW);
    setPicked(winnerId);
    setLastResult({ winner: w, loser: l, delta, upset: pW < 0.4 });
    setStreak(s => s + 1);
    setTimeout(() => { vote(winnerId, loserId); next(); }, 380);
  }, [pair, picked, state, vote, next]);

  const onSkip = useCallback(() => {
    if (picked) return;
    setLastResult(null);
    next();
  }, [picked, next]);

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
        <div className="vote-prompt">
          <span className="prompt-label">PROMPT</span>
          <h1>Would you rather work at</h1>
        </div>
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
          hotkey="← / 1"
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
          hotkey="2 / →"
        />
      </div>

      <div className="vote-footer">
        <button className="skip-btn" onClick={onSkip} disabled={!!picked}>
          <kbd>space</kbd> skip
        </button>
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
        <div className="streak-meta">
          {streak > 0 && <span>streak: <strong>{streak}</strong></span>}
        </div>
      </div>
    </div>
  );
}

interface CompanyCardProps {
  company: CompanyState;
  cohort: CohortId;
  side: 'left' | 'right';
  onClick: () => void;
  picked: boolean;
  dimmed: boolean;
  hotkey: string;
}

function CompanyCard({ company, cohort, onClick, picked, dimmed, side, hotkey }: CompanyCardProps) {
  const elo = effectiveElo(company, cohort);
  const rank = company.rank;
  const trend = company.delta24h || 0;
  return (
    <button
      className={`company-card ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''} side-${side}`}
      onClick={onClick}
    >
      <div className="card-top">
        <Logo company={company} size={72} />
        <SectorPill sectorId={company.sector} />
      </div>
      <div className="card-mid">
        <h2 className="card-name">{company.name}</h2>
        <p className="card-tagline">{company.tagline}</p>
      </div>
      <div className="card-bottom">
        <div className="card-stat">
          <div className="stat-label">ELO</div>
          <div className="stat-num">{Math.round(elo)}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">RANK</div>
          <div className="stat-num">#{rank}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">VOTES</div>
          <div className="stat-num">{company.votes.toLocaleString()}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">24H</div>
          <div className={`stat-num trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}`}>
            {trend > 0.5 ? '+' : ''}{Math.round(trend)}
          </div>
        </div>
      </div>
      <div className="card-hotkey">{hotkey}</div>
    </button>
  );
}
