'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { LeaderboardRow } from './LeaderboardRow';
import { SuggestModal } from './SuggestModal';
import { effectiveElo } from '@/lib/store';
import { COHORTS } from '@/lib/data';
import { useShell } from '@/components/Shell';
import { useSectors } from '@/lib/sectors-context';
import type { StoreState, CohortId } from '@/lib/types';
import type { RowData } from './types';

interface LeaderboardProps {
  state: StoreState;
  cohort: CohortId;
}

type SortKey = 'elo' | 'name' | 'votes' | 'trend' | 'sector';
type SortDir = 'asc' | 'desc';

function SkeletonRow({ gridCols }: { gridCols: string }) {
  return (
    <div className="lb-row" style={{ gridTemplateColumns: gridCols }} aria-hidden="true">
      <div className="cell cell-rank">
        <div className="skeleton" style={{ width: 18, height: 14 }} />
        <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
      </div>
      <div className="cell cell-company">
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
        <div className="row-info" style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '55%', height: 13, marginBottom: 4 }} />
          <div className="skeleton" style={{ width: '80%', height: 11 }} />
        </div>
      </div>
      <div className="cell cell-sector"><div className="skeleton" style={{ width: 70, height: 18 }} /></div>
      <div className="cell cell-elo"><div className="skeleton" style={{ width: 40, height: 13, marginLeft: 'auto' }} /></div>
      <div className="cell cell-trend"><div className="skeleton" style={{ width: 30, height: 13, marginLeft: 'auto' }} /></div>
      <div className="cell cell-votes"><div className="skeleton" style={{ width: 36, height: 13, marginLeft: 'auto' }} /></div>
      <div className="cell cell-spark"><div className="skeleton" style={{ width: '100%', height: 14 }} /></div>
    </div>
  );
}

export function Leaderboard({ state, cohort }: LeaderboardProps) {
  const activeSectors = useSectors();
  // Play the row reveal animation only on the first ever load — not when the
  // user navigates back to the leaderboard. `animate` is captured at mount so
  // marking revealed doesn't abort an in-flight animation.
  const { leaderboardRevealed, markLeaderboardRevealed } = useShell();
  const [animate] = useState(!leaderboardRevealed);
  useEffect(() => {
    if (!leaderboardRevealed) markLeaderboardRevealed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sortBy, setSortBy] = useState<SortKey>('elo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [modal, setModal] = useState<'missing_company' | 'tag_edit' | null>(null);

  const rows = useMemo<RowData[]>(() => {
    let arr: RowData[] = Object.values(state.companies).map(c => ({
      ...c,
      effElo: effectiveElo(c, cohort),
      displayRank: 0,
    }));
    // Assign Points-based rank before any filtering so it always reflects true placement.
    // Stable tie-break by id.
    arr.sort((a, b) => {
      if (b.effElo !== a.effElo) return b.effElo - a.effElo;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    arr.forEach((c, i) => { c.displayRank = i + 1; });
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
        default: {
          av = a.effElo;
          bv = b.effElo;
          break;
        }
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      // stable tie-break by id
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return arr;
  }, [state.companies, sortBy, sortDir, query, sectorFilter, cohort]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir(key === 'name' || key === 'sector' ? 'asc' : 'desc'); }
  };

  const gridCols = '90px 1fr 100px 90px 90px 90px 160px';

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
    <>
    {modal && <SuggestModal mode={modal} onClose={() => setModal(null)} />}
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
          {activeSectors.map(s => (
            <button key={s.id} className={`chip ${sectorFilter === s.id ? 'active' : ''}`} onClick={() => setSectorFilter(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="lb-results-count">
        {state.loaded ? (
          <>
            <span className="dot">·</span>
            <span>{state.totalVotes.toLocaleString()} total votes</span>
            <span className="dot">·</span>
            <span>cohort: <strong>{currentCohortLabel}</strong></span>
            <span className="dot">·</span>
            <span>Rankings update hourly</span>
          </>
        ) : (
          <span className="skeleton" style={{ width: 220, height: 12 }} />
        )}
      </div>

      <div className="lb-table">
        <div className="lb-thead" style={{ gridTemplateColumns: gridCols }}>
          <SortHead id="elo" label="#" />
          <SortHead id="name" label="Company" />
          <SortHead id="sector" label="Sector" />
          <SortHead id="elo" label="Points" align="right" />
          <SortHead id="trend" label="24h" align="right" />
          <SortHead id="votes" label="Votes" align="right" />
          <div className="th th-noclick">Movement</div>
        </div>
        <div className={`lb-tbody ${state.loaded && animate ? 'fade-in' : ''}`}>
          {!state.loaded
            ? Array.from({ length: 15 }).map((_, i) => (
                <SkeletonRow key={i} gridCols={gridCols} />
              ))
            : rows.map(c => (
                <LeaderboardRow key={c.id} c={c} showTrend={true} gridCols={gridCols} />
              ))}
          {state.loaded && rows.length === 0 && <div className="lb-empty">No companies match.</div>}
        </div>
      </div>
      <div className="lb-footer">
        <button className="lb-suggest-btn" onClick={() => setModal('missing_company')}>
          + Missing a company?
        </button>
        <button className="lb-suggest-btn" onClick={() => setModal('tag_edit')}>
          Wrong sector tags?
        </button>
        <Link href="/methodology" className="lb-suggest-btn">
          How rankings work
        </Link>
      </div>
    </div>
    </>
  );
}
