'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useOffices, companiesByRegion, REGIONS } from '@/lib/offices';
import { RegionList } from './RegionList';
import type { StoreState } from '@/lib/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Markers are drawn by WebGL, which can't parse oklch(), so the fill is one rgb
// constant approximating --accent (oklch(0.5 0.18 290)). Documented exception to
// the OKLCH-only rule — every HTML/CSS element below still uses var(--accent).
const MARKER_COLOR = 'rgb(108, 79, 201)';

// Client-side daily load budget: trips OUR soft limit before Mapbox's account cap,
// so a viral day degrades to the list gracefully instead of an abrupt hard stop.
const DAILY_LOAD_BUDGET = 200;
const LOAD_TIMEOUT_MS = 8000;

/** Returns true if we're under today's budget (and records this load). */
function withinLoadBudget(): boolean {
  try {
    const key = `tierboard:mapLoads:${new Date().toISOString().slice(0, 10)}`;
    const n = Number(localStorage.getItem(key) ?? 0);
    if (n >= DAILY_LOAD_BUDGET) return false;
    localStorage.setItem(key, String(n + 1));
    return true;
  } catch {
    return true; // localStorage unavailable → don't block the map
  }
}

export function MapScreen({ state }: { state: StoreState }) {
  const { offices, loading: officesLoading } = useOffices();
  const rankings = useMemo(() => companiesByRegion(state, offices), [state, offices]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [fallback, setFallback] = useState(!TOKEN);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ name: string; elo: number } | null>(null);

  // ── Init the map exactly once per visit (3A) ──────────────────────────────
  // Empty deps + a ref guard: re-renders (e.g. realtime company updates) never
  // rebuild the map. Returning to /map later mounts fresh = one new load.
  useEffect(() => {
    if (fallback || !TOKEN || !containerRef.current || mapRef.current) return;
    if (!withinLoadBudget()) { setFallback(true); return; }

    // new mapboxgl.Map() throws synchronously when WebGL is unavailable
    // (GPU disabled, old device, headless). That throw bypasses map.on('error'),
    // so catch it here and degrade to the list — never a crashed page.
    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        projection: 'globe',
        center: [-30, 25],
        zoom: 1.5,
        attributionControl: false,
      });
    } catch (err) {
      console.error('map init failed (WebGL unavailable?)', err);
      setFallback(true);
      return;
    }
    mapRef.current = map;

    // Any style/tile/auth/quota failure (SDK fail, rate-limit, spend-cap tripped)
    // surfaces here → degrade to the list, never a blank/broken map box.
    map.on('error', () => setFallback(true));
    map.on('load', () => {
      map.setFog({}); // subtle globe atmosphere
      setMapLoaded(true);
    });

    // If the map never finishes loading (slow/blocked), fall back.
    const t = setTimeout(() => { if (!mapRef.current?.isStyleLoaded()) setFallback(true); }, LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  // ── Add / update marker data without rebuilding the map ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || officesLoading) return;

    const features = offices
      .map(o => {
        const c = state.companies[o.companyId];
        if (!c) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
          properties: { companyId: c.id, name: c.name, elo: Math.round(c.elo) },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const data = { type: 'FeatureCollection' as const, features };

    const existing = map.getSource('companies') as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }

    const elos = features.map(f => f.properties.elo);
    const minElo = elos.length ? Math.min(...elos) : 1000;
    const maxElo = elos.length ? Math.max(...elos) : 2000;

    map.addSource('companies', { type: 'geojson', data });
    map.addLayer({
      id: 'company-markers',
      type: 'circle',
      source: 'companies',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'elo'], minElo, 4, maxElo, 13],
        'circle-color': MARKER_COLOR,
        'circle-opacity': 0.82,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.on('click', 'company-markers', e => {
      // Cast to the exact properties shape we set on each feature above.
      const f = e.features?.[0] as { properties: { name: string; elo: number } } | undefined;
      if (!f) return;
      setSelected({ name: f.properties.name, elo: f.properties.elo });
    });
    map.on('mouseenter', 'company-markers', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'company-markers', () => { map.getCanvas().style.cursor = ''; });
  }, [mapLoaded, offices, officesLoading, state.companies]);

  function flyToRegion(region: string) {
    setSelectedRegion(region);
    const meta = REGIONS[region];
    mapRef.current?.flyTo({ center: meta.center, zoom: meta.zoom, pitch: 45, duration: 1400 });
  }

  // ── Fallback: no token / map failed / budget tripped → the rankings list ──
  if (fallback) {
    return (
      <div className="map-screen">
        <div className="map-fallback">
          <p className="map-fallback-note">Map unavailable — showing prestige by city.</p>
          <RegionList rankings={rankings} />
        </div>
      </div>
    );
  }

  const selectedRanking = rankings.filter(r => r.region === selectedRegion);

  return (
    <div className="map-screen">
      <div ref={containerRef} className="map-canvas" />

      <aside className="map-panel">
        <div className="map-panel-head">
          <span className="map-panel-title">Prestige by city</span>
        </div>
        <div className="map-region-chips">
          {rankings.map(r => (
            <button
              key={r.region}
              className={`map-chip ${selectedRegion === r.region ? 'active' : ''}`}
              onClick={() => flyToRegion(r.region)}
            >
              {REGIONS[r.region].label}
            </button>
          ))}
        </div>
        <div className="map-panel-body">
          {selectedRegion ? (
            <RegionList rankings={selectedRanking} limit={10} />
          ) : (
            <p className="map-empty">Pick a city to see its most prestigious companies.</p>
          )}
        </div>
      </aside>

      {selected && (
        <div className="map-detail" onClick={() => setSelected(null)}>
          <span className="map-detail-name">{selected.name}</span>
          <span className="map-detail-elo">{selected.elo.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
