'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { CompanyState, StoreState, Office } from './types';

// Curated metro keys → display label + map camera target ([lng, lat], zoom).
// An office's `region` is one of these keys (or null if it falls outside any
// tracked metro). Used both for the region picker UI and the map fly-to.
export const REGIONS: Record<string, { label: string; center: [number, number]; zoom: number }> = {
  bay: { label: 'SF Bay Area', center: [-122.2, 37.6], zoom: 8.5 },
  nyc: { label: 'New York City', center: [-74.0, 40.71], zoom: 9 },
  seattle: { label: 'Seattle', center: [-122.33, 47.61], zoom: 9 },
  la: { label: 'Los Angeles', center: [-118.24, 34.05], zoom: 8.5 },
  austin: { label: 'Austin', center: [-97.74, 30.27], zoom: 9 },
  boston: { label: 'Boston', center: [-71.06, 42.36], zoom: 9 },
  chicago: { label: 'Chicago', center: [-87.63, 41.88], zoom: 9 },
  dc: { label: 'Washington DC', center: [-77.04, 38.9], zoom: 9 },
  toronto: { label: 'Toronto', center: [-79.38, 43.65], zoom: 9 },
  vancouver: { label: 'Vancouver', center: [-123.12, 49.28], zoom: 9 },
  london: { label: 'London', center: [-0.13, 51.51], zoom: 9 },
  dublin: { label: 'Dublin', center: [-6.26, 53.35], zoom: 10 },
  bangalore: { label: 'Bangalore', center: [77.59, 12.97], zoom: 10 },
  singapore: { label: 'Singapore', center: [103.82, 1.35], zoom: 10 },
  'tel-aviv': { label: 'Tel Aviv', center: [34.78, 32.07], zoom: 10 },
};

interface OfficeRow {
  id: number;
  company_id: string;
  label: string | null;
  city: string;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  is_hq: boolean;
}

function rowToOffice(r: OfficeRow): Office {
  return {
    id: r.id,
    companyId: r.company_id,
    label: r.label,
    city: r.city,
    region: r.region,
    country: r.country,
    lat: Number(r.lat),
    lng: Number(r.lng),
    isHq: r.is_hq,
  };
}

/**
 * Fetch all company offices, mapping snake_case rows → camelCase Office[].
 * The `company_offices` table may not exist yet in the dev DB (another lane
 * builds it); the error path returns an empty list rather than throwing.
 */
export function useOffices() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await supabase
        .from('company_offices')
        .select('id, company_id, label, city, region, country, lat, lng, is_hq');

      if (cancelled) return;

      if (res.error) {
        console.error('load offices failed', res.error);
        setOffices([]);
        setError(new Error(res.error.message));
        setLoading(false);
        return;
      }

      setOffices(((res.data ?? []) as OfficeRow[]).map(rowToOffice));
      setError(null);
      setLoading(false);
    }

    load();

    return () => { cancelled = true; };
  }, []);

  return { offices, loading, error };
}

export interface RegionRanking {
  region: string;
  label: string;
  companies: CompanyState[];
}

/**
 * Group companies by curated metro region, ranked by ELO descending.
 *
 * Pure (no I/O). For each region key present in REGIONS:
 *  - A company with offices in multiple regions appears in EACH of those regions.
 *  - A company with multiple offices in the SAME region appears ONCE there
 *    (deduped by company id).
 *  - Companies are sorted by `elo` descending within each region.
 *
 * <3 rule: regions with fewer than 3 companies are omitted from the result.
 * Offices whose `region` is null or is not a known REGIONS key are ignored.
 */
export function companiesByRegion(state: StoreState, offices: Office[]): RegionRanking[] {
  const byRegion: Record<string, Set<string>> = {};

  for (const office of offices) {
    const region = office.region;
    if (!region || !(region in REGIONS)) continue;
    if (!state.companies[office.companyId]) continue;
    (byRegion[region] ??= new Set()).add(office.companyId);
  }

  const result: RegionRanking[] = [];
  for (const region of Object.keys(byRegion)) {
    const ids = byRegion[region];
    if (ids.size < 3) continue;
    const companies = [...ids]
      .map(id => state.companies[id])
      .sort((a, b) => b.elo - a.elo);
    result.push({ region, label: REGIONS[region].label, companies });
  }
  return result;
}
