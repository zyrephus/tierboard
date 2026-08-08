'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { RANGES, type RangeKey, type Series, type SeriesPoint } from './chart';

interface SeriesRow { company_id: string; t: string; elo: number }

// Session cache, one entry per company per range. Per company rather than per
// selection so removing a line needs no request at all and adding one fetches
// only the company that joined. Snapshots are hourly, so a page load is a fresh
// enough read and nothing revalidates within a session.
const pointCache = new Map<string, SeriesPoint[]>();

const cacheKeyFor = (companyId: string, range: RangeKey) => companyId + '|' + range;
const missingFrom = (companyIds: string[], range: RangeKey) =>
  companyIds.filter(id => !pointCache.has(cacheKeyFor(id, range)));

async function fetchPoints(companyIds: string[], range: RangeKey): Promise<boolean> {
  if (companyIds.length === 0) return true;
  const { data, error } = await supabase.rpc('get_elo_series', {
    p_company_ids: companyIds,
    p_range: range,
  });
  if (error) return false;
  const byCo: Record<string, SeriesPoint[]> = {};
  for (const r of (data ?? []) as SeriesRow[]) {
    (byCo[r.company_id] ??= []).push({ t: new Date(r.t).getTime(), elo: Number(r.elo) });
  }
  for (const id of companyIds) pointCache.set(cacheKeyFor(id, range), byCo[id] ?? []);
  return true;
}

export function useEloHistory(companyIds: string[], range: RangeKey, nonce = 0) {
  const assemble = (): Series[] =>
    companyIds.map(id => ({ companyId: id, points: pointCache.get(cacheKeyFor(id, range)) ?? [] }));

  const ready = missingFrom(companyIds, range).length === 0;
  const [series, setSeries] = useState<Series[]>(ready ? assemble() : []);
  // The range `series` was fetched for. Callers render against this so the plot
  // keeps showing the old window until the new one arrives.
  const [shownRange, setShownRange] = useState<RangeKey>(range);
  const [loading, setLoading] = useState(!ready);
  const [error, setError] = useState(false);
  // Whether the chart has ever painted. Until it has, a fetch shows the skeleton;
  // after that it keeps the previous plot on screen instead.
  const painted = useRef(ready);
  const key = companyIds.join(',') + '|' + range + '|' + nonce;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (companyIds.length === 0) {
      setSeries([]); setShownRange(range); setLoading(false);
      return;
    }
    const missing = missingFrom(companyIds, range);
    if (missing.length === 0) {
      painted.current = true;
      setSeries(assemble()); setShownRange(range); setLoading(false);
      return;
    }
    if (!painted.current) setLoading(true);
    fetchPoints(missing, range).then(async ok => {
      if (cancelled) return;
      if (!ok) { if (!painted.current) setError(true); setLoading(false); return; }
      painted.current = true;
      setSeries(assemble());
      setShownRange(range);
      setLoading(false);
      // Warm the other ranges one at a time. The RPC takes seconds, so without
      // this a range switch is a long freeze followed by a jump; with it the
      // switch is a cache hit and the chart animates immediately.
      for (const r of RANGES) {
        if (cancelled) return;
        await fetchPoints(missingFrom(companyIds, r), r);
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
