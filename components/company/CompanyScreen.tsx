'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SectorPill } from '@/components/SectorPill';
import { TrendArrow } from '@/components/leaderboard/TrendArrow';
import { PrestigeHistory, useCompanyHistory } from './PrestigeHistory';
import { supabase } from '@/lib/supabase';
import { useSectors } from '@/lib/sectors-context';
import { winProbability, sectorStandings, closestPeers, isRanked } from '@/lib/company';
import { useCountUp } from '@/lib/useCountUp';
import type { StoreState } from '@/lib/types';

interface Office { city: string; region: string | null; country: string; is_hq: boolean }

function OverallRank({ rank }: { rank: number }) {
  return <>#{Math.round(useCountUp(rank))}</>;
}

function Stat({ value, label, prefix = '', of }: { value: number; label: string; prefix?: string; of?: number }) {
  const n = useCountUp(value);
  return (
    <div className="co-stat">
      <span className="co-stat-val">
        {prefix}{Math.round(n).toLocaleString()}
        {of != null && <span className="co-stat-of"> / {of}</span>}
      </span>
      <span className="co-stat-label">{label}</span>
    </div>
  );
}

// Mirrors the real layout block for block so nothing shifts when data lands.
function CompanySkeleton() {
  return (
    <div className="co-page" aria-hidden="true">
      <header className="co-head">
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 10 }} />
        <div className="co-head-text">
          <div className="skeleton" style={{ width: 180, height: 24 }} />
          <div className="skeleton" style={{ width: '70%', height: 13 }} />
          <div className="co-tags">
            <div className="skeleton" style={{ width: 64, height: 17 }} />
            <div className="skeleton" style={{ width: 52, height: 17 }} />
          </div>
          <div className="skeleton" style={{ width: 90, height: 17 }} />
        </div>
        <div className="skeleton" style={{ width: 52, height: 28 }} />
      </header>

      <div className="co-stats">
        {[72, 88, 56, 40].map((w, i) => (
          <div className="co-stat" key={i}>
            <div className="skeleton" style={{ width: w, height: 26 }} />
            <div className="skeleton" style={{ width: w * 0.8, height: 10 }} />
          </div>
        ))}
      </div>

      <section className="co-section">
        <div className="co-chart-head">
          <div className="skeleton" style={{ width: 110, height: 11 }} />
          <div className="skeleton" style={{ width: 140, height: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 200 }} />
      </section>

      <section className="co-section">
        <div className="skeleton" style={{ width: 150, height: 11 }} />
        <div className="co-peers">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="co-peer" key={i}>
              <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 5 }} />
              <div className="skeleton" style={{ width: 84, height: 13 }} />
              <div className="skeleton" style={{ flex: 1, height: 3 }} />
              <div className="skeleton" style={{ width: 30, height: 12 }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function useOffices(companyId: string) {
  const [offices, setOffices] = useState<Office[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('company_offices')
      .select('city, region, country, is_hq')
      .eq('company_id', companyId)
      .order('is_hq', { ascending: false })
      .then(({ data }) => { if (!cancelled) setOffices((data ?? []) as Office[]); });
    return () => { cancelled = true; };
  }, [companyId]);
  return offices;
}

export function CompanyScreen({ id, state }: { id: string; state: StoreState }) {
  const sectors = useSectors();
  const offices = useOffices(id);
  const history = useCompanyHistory(id);
  const company = state.companies[id];

  const standings = useMemo(
    () => (company ? sectorStandings(company, state.companies) : []),
    [company, state.companies],
  );
  const peers = useMemo(
    () => (company ? closestPeers(company, state.companies) : []),
    [company, state.companies],
  );

  // Hold the whole card until every source has landed — the board, this
  // company's history, and its offices — so the page never assembles in pieces.
  if (!state.loaded || history.loading || offices == null) return <CompanySkeleton />;
  if (!company) {
    return (
      <div className="co-page co-missing">
        <h1>No such company</h1>
        <Link href="/board" className="lb-suggest-btn">Back to the board</Link>
      </div>
    );
  }

  const ranked = isRanked(company);
  const sectorLabel = (sid: string) => sectors.find(s => s.id === sid)?.label ?? sid;

  return (
    <div className="co-page">
      <header className="co-head">
        <Logo company={company} size={64} />
        <div className="co-head-text">
          <h1 className="co-name">{company.name}</h1>
          <p className="co-tagline">{company.tagline}</p>
          <div className="co-tags">
            {company.sectors.map(sid => <SectorPill key={sid} sectorId={sid} size="md" />)}
          </div>
          {company.websiteUrl && (
            <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="co-website">
              {company.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              <span className="co-website-arrow">↗</span>
            </a>
          )}
        </div>
        <div className="co-rank">
          <span className="co-rank-num">{ranked ? <OverallRank rank={company.rank ?? 0} /> : '—'}</span>
          <span className="co-rank-label">overall</span>
        </div>
      </header>

      {!ranked ? (
        <div className="co-unranked">
          Not enough votes yet. {company.name} joins the board after the next hourly ranking run.
        </div>
      ) : (
        <>
          <div className="co-stats">
            <Stat value={Math.round(company.elo)} label="Prestige" />
            {standings.map(s => (
              <Stat key={s.sectorId} value={s.rank} of={s.total} prefix="#" label={`in ${sectorLabel(s.sectorId)}`} />
            ))}
            <Stat value={company.games} label="Matchups" />
            <div className="co-stat">
              <span className="co-stat-val co-stat-trend"><TrendArrow value={company.delta24h} /></span>
              <span className="co-stat-label">24h</span>
            </div>
          </div>

          <PrestigeHistory history={history} />

          <section className="co-section">
            <h2 className="co-section-title">Model favors {company.name} over</h2>
            <div className="co-peers">
              {peers.map(p => {
                const pct = Math.round(winProbability(company.elo, p.elo) * 100);
                return (
                  <Link href={`/company/${p.id}`} key={p.id} className="co-peer">
                    <Logo company={p} size={24} />
                    <span className="co-peer-name">{p.name}</span>
                    <span className="co-peer-bar">
                      <span className="co-peer-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className={`co-peer-pct ${pct >= 50 ? 'up' : 'down'}`}>{pct}%</span>
                  </Link>
                );
              })}
            </div>
            <p className="co-note">
              Predicted from the Bradley-Terry index. <Link href="/methodology">How rankings work</Link>
            </p>
          </section>
        </>
      )}

      {offices && offices.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Offices</h2>
          <div className="co-offices">
            {offices.map((o, i) => (
              <span className="co-office" key={i}>
                {o.city}
                {o.is_hq && <span className="co-hq">HQ</span>}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
