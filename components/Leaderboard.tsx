'use client';

import { useState, useMemo } from 'react';
import { Logo, SectorPill } from './Logo';
import { effectiveElo } from '@/lib/store';
import { SECTORS, COHORTS } from '@/lib/data';
import type { StoreState, CompanyState, CohortId } from '@/lib/types';

interface LeaderboardProps {
  state: StoreState;
  cohort: CohortId;
}

type SortKey = 'elo' | 'name' | 'votes' | 'trend' | 'sector';
type SortDir = 'asc' | 'desc';

interface RowData extends CompanyState {
  effElo: number;
  displayRank: number;
}

function tierFor(elo: number): string {
  if (elo >= 1750) return 'S';
  if (elo >= 1600) return 'A';
  if (elo >= 1450) return 'B';
  if (elo >= 1300) return 'C';
  return 'D';
}

export function Leaderboard({ state, cohort }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortKey>('elo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [showTrend, setShowTrend] = useState(true);

  const rows = useMemo<RowData[]>(() => {
    let arr: RowData[] = Object.values(state.companies).map(c => ({
      ...c,
      effElo: effectiveElo(c, cohort),
      displayRank: 0,
    }));
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q));
    }
    if (sectorFilter !== 'all') {
      arr = arr.filter(c => c.sector === sectorFilter);
    }
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortBy) {
        case 'name':   av = a.name;          bv = b.name;          break;
        case 'votes':  av = a.votes;         bv = b.votes;         break;
        case 'trend':  av = a.delta24h || 0; bv = b.delta24h || 0; break;
        case 'sector': av = a.sector;        bv = b.sector;        break;
        case 'elo':
        default:       av = a.effElo;        bv = b.effElo;        break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    arr.forEach((c, i) => { c.displayRank = i + 1; });
    return arr;
  }, [state.companies, sortBy, sortDir, query, sectorFilter, cohort]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir(key === 'name' || key === 'sector' ? 'asc' : 'desc'); }
  };

  const gridCols = showTrend
    ? '90px 1fr 100px 90px 90px 90px 160px'
    : '90px 1fr 100px 90px 90px 160px';

  function SortHead({ id, label, align = 'left' }: { id: SortKey; label: string; align?: 'left' | 'right' }) {
    return (
      <button
        className={`th ${sortBy === id ? 'active' : ''}`}
        onClick={() => toggleSort(id)}
        style={{ textAlign: align, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
      >
        <span>{label}</span>
        <span className="th-arrow">{sortBy === id ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    );
  }

  const currentCohortLabel = COHORTS.find(c => c.id === cohort)?.label;

  return (
    <div className="leaderboard">
      <div className="lb-toolbar">
        <div className="lb-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            type="text"
            placeholder="Filter 150 companies…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button className="clear-btn" onClick={() => setQuery('')}>×</button>}
        </div>
        <div className="lb-filters">
          <button className={`chip ${sectorFilter === 'all' ? 'active' : ''}`} onClick={() => setSectorFilter('all')}>All</button>
          {SECTORS.map(s => (
            <button key={s.id} className={`chip ${sectorFilter === s.id ? 'active' : ''}`} onClick={() => setSectorFilter(s.id)}>{s.label}</button>
          ))}
        </div>
        <div className="lb-toggle">
          <label>
            <input type="checkbox" checked={showTrend} onChange={e => setShowTrend(e.target.checked)} />
            <span>trend column</span>
          </label>
        </div>
      </div>

      <div className="lb-results-count">
        <span><strong>{rows.length}</strong> {rows.length === 1 ? 'company' : 'companies'}</span>
        <span className="dot">·</span>
        <span>{state.totalVotes.toLocaleString()} total votes</span>
        <span className="dot">·</span>
        <span>cohort: <strong>{currentCohortLabel}</strong></span>
      </div>

      <div className="lb-table">
        <div className="lb-thead" style={{ gridTemplateColumns: gridCols }}>
          <SortHead id="elo" label="#" />
          <SortHead id="name" label="Company" />
          <SortHead id="sector" label="Sector" />
          <SortHead id="elo" label="ELO" align="right" />
          {showTrend && <SortHead id="trend" label="24h" align="right" />}
          <SortHead id="votes" label="Votes" align="right" />
          <div className="th th-noclick">Movement</div>
        </div>
        <div className="lb-tbody">
          {rows.map(c => (
            <LeaderboardRow key={c.id} c={c} showTrend={showTrend} gridCols={gridCols} />
          ))}
          {rows.length === 0 && <div className="lb-empty">No companies match.</div>}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ c, showTrend, gridCols }: { c: RowData; showTrend: boolean; gridCols: string }) {
  const trend = c.delta24h || 0;
  const rankChange = c.rankPrev != null ? c.rankPrev - (c.rank ?? c.rankPrev) : 0;
  const tierBadge = tierFor(c.effElo);
  return (
    <div className="lb-row" style={{ gridTemplateColumns: gridCols }}>
      <div className="cell cell-rank">
        <span className="rank-num">{c.displayRank}</span>
        <span className={`tier-badge tier-${tierBadge}`}>{tierBadge}</span>
      </div>
      <div className="cell cell-company">
        <Logo company={c} size={28} />
        <div className="row-info">
          <span className="row-name">{c.name}</span>
          <span className="row-tag">{c.tagline}</span>
        </div>
      </div>
      <div className="cell cell-sector">
        <SectorPill sectorId={c.sector} />
      </div>
      <div className="cell cell-elo">
        <span className="elo-num">{Math.round(c.effElo)}</span>
      </div>
      {showTrend && (
        <div className="cell cell-trend">
          <TrendArrow value={trend} />
        </div>
      )}
      <div className="cell cell-votes">
        <span className="votes-num">{c.votes.toLocaleString()}</span>
      </div>
      <div className="cell cell-spark">
        <Sparkline elo={c.effElo} startElo={c.startingElo} rankChange={rankChange} />
      </div>
    </div>
  );
}

function TrendArrow({ value }: { value: number }) {
  const dir = value > 0.5 ? 'up' : value < -0.5 ? 'down' : 'flat';
  const sym = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
  const display = dir === 'flat' ? '0' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  return (
    <span className={`trend trend-${dir}`}>
      <span className="trend-sym">{sym}</span>
      <span className="trend-val">{display}</span>
    </span>
  );
}

function Sparkline({ elo, startElo, rankChange }: { elo: number; startElo: number; rankChange: number }) {
  const pct = Math.max(0, Math.min(1, (elo - 1100) / 800));
  const startPct = Math.max(0, Math.min(1, (startElo - 1100) / 800));
  const up = elo >= startElo;
  return (
    <div className="spark-wrap">
      <div className="spark-bar-bg">
        <div className="spark-bar-start" style={{ left: `${startPct * 100}%` }} />
        <div
          className={`spark-bar-fill ${up ? 'up' : 'down'}`}
          style={{ left: `${Math.min(startPct, pct) * 100}%`, width: `${Math.abs(pct - startPct) * 100}%` }}
        />
        <div className="spark-bar-tick" style={{ left: `${pct * 100}%` }} />
      </div>
      <span className={`spark-rank ${rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : 'flat'}`}>
        {rankChange > 0 ? `▲${rankChange}` : rankChange < 0 ? `▼${Math.abs(rankChange)}` : '—'}
      </span>
    </div>
  );
}
