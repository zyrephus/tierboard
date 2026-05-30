'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { RangeKey, Series, SeriesPoint } from './chart';

interface SeriesRow { company_id: string; t: string; elo: number }

export function useEloHistory(companyIds: string[], range: RangeKey, nonce = 0) {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const key = companyIds.join(',') + '|' + range + '|' + nonce;

  useEffect(() => {
    let cancelled = false;
    if (companyIds.length === 0) {
      setSeries([]); setLoading(false); setError(false);
      return;
    }
    setLoading(true); setError(false);
    supabase
      .rpc('get_elo_series', { p_company_ids: companyIds, p_range: range })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(true); setLoading(false); return; }
        const byCo: Record<string, SeriesPoint[]> = {};
        for (const r of (data ?? []) as SeriesRow[]) {
          (byCo[r.company_id] ??= []).push({ t: new Date(r.t).getTime(), elo: Number(r.elo) });
        }
        setSeries(companyIds.map(id => ({ companyId: id, points: byCo[id] ?? [] })));
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
