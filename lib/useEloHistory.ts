'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { RangeKey, Series, SeriesPoint } from './chart';

interface SeriesRow { company_id: string; t: string; elo: number }

// Session cache of fetched series, keyed by selection + range. Lets the chart
// paint instantly when you navigate back (no skeleton flash) while still
// revalidating in the background — the underlying data only changes hourly.
const seriesCache = new Map<string, Series[]>();

export function useEloHistory(companyIds: string[], range: RangeKey, nonce = 0) {
  const cacheKey = companyIds.join(',') + '|' + range;
  const cached = seriesCache.get(cacheKey);
  const [series, setSeries] = useState<Series[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);
  const key = cacheKey + '|' + nonce;

  useEffect(() => {
    let cancelled = false;
    if (companyIds.length === 0) {
      setSeries([]); setLoading(false); setError(false);
      return;
    }
    // Serve cache immediately; only show the skeleton when we have nothing yet.
    const have = seriesCache.get(cacheKey);
    if (have) { setSeries(have); setLoading(false); } else { setLoading(true); }
    setError(false);
    supabase
      .rpc('get_elo_series', { p_company_ids: companyIds, p_range: range })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { if (!have) setError(true); setLoading(false); return; }
        const byCo: Record<string, SeriesPoint[]> = {};
        for (const r of (data ?? []) as SeriesRow[]) {
          (byCo[r.company_id] ??= []).push({ t: new Date(r.t).getTime(), elo: Number(r.elo) });
        }
        const next = companyIds.map(id => ({ companyId: id, points: byCo[id] ?? [] }));
        seriesCache.set(cacheKey, next);
        setSeries(next);
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { series, loading, error };
}

// Earliest snapshot timestamp (epoch ms) — used to gate range buttons.
export function useEarliestSnapshot(): number | null {
  const [earliest, setEarliest] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from('elo_snapshots')
      .select('t')
      .order('t', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setEarliest(new Date(data[0].t).getTime());
      });
  }, []);
  return earliest;
}
