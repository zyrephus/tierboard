'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { RANGES, type RangeKey, type Series, type SeriesPoint } from './chart';

interface SeriesRow { company_id: string; t: string; elo: number }

// Session cache of fetched series, keyed by selection + range. Lets the chart
// paint instantly when you navigate back (no skeleton flash) while still
// revalidating in the background — the underlying data only changes hourly.
const seriesCache = new Map<string, Series[]>();

const cacheKeyFor = (companyIds: string[], range: RangeKey) => companyIds.join(',') + '|' + range;

async function fetchSeries(companyIds: string[], range: RangeKey): Promise<Series[] | null> {
  const { data, error } = await supabase.rpc('get_elo_series', {
    p_company_ids: companyIds,
    p_range: range,
  });
  if (error) return null;
  const byCo: Record<string, SeriesPoint[]> = {};
  for (const r of (data ?? []) as SeriesRow[]) {
    (byCo[r.company_id] ??= []).push({ t: new Date(r.t).getTime(), elo: Number(r.elo) });
  }
  const next = companyIds.map(id => ({ companyId: id, points: byCo[id] ?? [] }));
  seriesCache.set(cacheKeyFor(companyIds, range), next);
  return next;
}

export function useEloHistory(companyIds: string[], range: RangeKey, nonce = 0) {
  const cacheKey = cacheKeyFor(companyIds, range);
  const cached = seriesCache.get(cacheKey);
  const [series, setSeries] = useState<Series[]>(cached ?? []);
  // The range `series` was fetched for. Callers render against this so the plot
  // keeps showing the old window until the new one arrives.
  const [shownRange, setShownRange] = useState<RangeKey>(range);
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
    if (have) { setSeries(have); setShownRange(range); setLoading(false); } else { setLoading(true); }
    setError(false);
    fetchSeries(companyIds, range).then(async next => {
      if (cancelled) return;
      if (!next) { if (!have) setError(true); setLoading(false); return; }
      setSeries(next);
      setShownRange(range);
      setLoading(false);
      // Warm the other ranges one at a time. The RPC takes seconds, so without
      // this a range switch is a long freeze followed by a jump; with it the
      // switch is a cache hit and the chart animates immediately.
      for (const r of RANGES) {
        if (cancelled) return;
        if (!seriesCache.has(cacheKeyFor(companyIds, r))) await fetchSeries(companyIds, r);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { series, shownRange, loading, error };
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
