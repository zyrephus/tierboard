'use client';

import { useState, useMemo } from 'react';
import { LeaderboardRow } from './LeaderboardRow';
import { effectiveElo } from '@/lib/store';
import { SECTORS, COHORTS } from '@/lib/data';
import type { StoreState, CohortId } from '@/lib/types';
import type { RowData } from './types';

interface LeaderboardProps {
  state: StoreState;
  cohort: CohortId;
}

type SortKey = 'elo' | 'name' | 'votes' | 'trend' | 'sector';
type SortDir = 'asc' | 'desc';

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
      arr = arr.filter(c => c.sectors.includes(sectorFilter));
    }
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortBy) {
        case 'name':   av = a.name;            bv = b.name;            break;
        case 'votes':  av = a.votes;           bv = b.votes;           break;
        case 'trend':  av = a.delta24h || 0;   bv = b.delta24h || 0;   break;
        case 'sector': av = a.sectors[0] ?? ''; bv = b.sectors[0] ?? ''; break;
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
            placeholder={`Filter ${Object.keys(state.companies).length} companies…`}
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
