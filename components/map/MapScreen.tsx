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

// Where a visitor spawns: a random major metro (not the empty globe), pitched so
// the 3D buildings of the Standard style read immediately.
const BIG_METROS = ['bay', 'nyc', 'london', 'seattle', 'la'];
const CITY_ZOOM = 11.5;
const CITY_PITCH = 55;

function withinLoadBudget(): boolean {
  try {
    const key = `tierboard:mapLoads:${new Date().toISOString().slice(0, 10)}`;
    const n = Number(localStorage.getItem(key) ?? 0);
    if (n >= DAILY_LOAD_BUDGET) return false;
    localStorage.setItem(key, String(n + 1));
    return true;
  } catch {
    return true;
  }
}

export function MapScreen({ state }: { state: StoreState }) {
  const { offices, loading: officesLoading } = useOffices();
  const rankings = useMemo(() => companiesByRegion(state, offices), [state, offices]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const spawnRef = useRef<string>(BIG_METROS[Math.floor(Math.random() * BIG_METROS.length)]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [fallback, setFallback] = useState(!TOKEN);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ name: string; elo: number } | null>(null);
  const [query, setQuery] = useState('');

  // ── Init the map exactly once per visit (3A) ──────────────────────────────
  useEffect(() => {
    if (fallback || !TOKEN || !containerRef.current || mapRef.current) return;
    if (!withinLoadBudget()) { setFallback(true); return; }

    const spawn = REGIONS[spawnRef.current];

    // new mapboxgl.Map() throws synchronously when WebGL is unavailable; that throw
    // bypasses map.on('error'), so catch it here and degrade to the list.
    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/standard', // 3D buildings + globe
        center: spawn.center,
        zoom: CITY_ZOOM,
        pitch: CITY_PITCH,
        attributionControl: false,
      });
    } catch (err) {
      console.error('map init failed (WebGL unavailable?)', err);
      setFallback(true);
      return;
    }
    mapRef.current = map;

    map.on('error', () => setFallback(true));
    map.on('style.load', () => {
      // Standard style is 3D by default; nudge the light for a crisp daytime look.
      try { map.setConfigProperty('basemap', 'lightPreset', 'day'); } catch {}
    });
    map.on('load', () => setMapLoaded(true));

    const t = setTimeout(() => { if (!mapRef.current?.isStyleLoaded()) setFallback(true); }, LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  // ── Add / update marker data + logos without rebuilding the map ───────────
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
          properties: {
            companyId: c.id,
            name: c.name,
            elo: Math.round(c.elo),
            logoId: c.logoUrl ? `logo-${c.id}` : '',
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const data = { type: 'FeatureCollection' as const, features };

    const existing = map.getSource('companies') as mapboxgl.GeoJSONSource | undefined;
    if (existing) { existing.setData(data); return; }

    const elos = features.map(f => f.properties.elo);
    const minElo = elos.length ? Math.min(...elos) : 1000;
    const maxElo = elos.length ? Math.max(...elos) : 2000;

    map.addSource('companies', { type: 'geojson', data });

    // Dots — visible when zoomed out, fade as logos take over on zoom-in.
    map.addLayer({
      id: 'company-dots',
      type: 'circle',
      source: 'companies',
      slot: 'top',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'elo'], minElo, 4, maxElo, 13],
        'circle-color': MARKER_COLOR,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.82, 12, 0],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Logos — fade in on zoom-in. icon-image references per-company images we load below.
    map.addLayer({
      id: 'company-logos',
      type: 'symbol',
      source: 'companies',
      slot: 'top',
      minzoom: 9,
      layout: {
        'icon-image': ['get', 'logoId'],
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
      },
      paint: {
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 1],
      },
    });

    // Load each company's logo as a map image (best-effort; failures just leave the dot).
    const loaded = new Set<string>();
    for (const f of features) {
      const id = f.properties.logoId;
      const c = state.companies[f.properties.companyId];
      if (!id || loaded.has(id) || map.hasImage(id) || !c.logoUrl) continue;
      loaded.add(id);
      map.loadImage(c.logoUrl, (error, image) => {
        if (error || !image || map.hasImage(id)) return; // failed → dot remains
        map.addImage(id, image);
      });
    }

    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0] as { properties: { name: string; elo: number } } | undefined;
      if (!f) return;
      setSelected({ name: f.properties.name, elo: f.properties.elo });
    };
    map.on('click', 'company-dots', onClick);
    map.on('click', 'company-logos', onClick);
    for (const layer of ['company-dots', 'company-logos']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
  }, [mapLoaded, offices, officesLoading, state.companies]);

  function flyToRegion(region: string) {
    setSelectedRegion(region);
    const map = mapRef.current;
    if (!map) return;
    // Fit the actual company points in this metro — zoom in as tight as possible
    // while keeping them all in frame (a fixed zoom just bunches them in the middle).
    const pts = offices.filter(o => o.region === region && state.companies[o.companyId]);
    if (pts.length === 0) {
      const meta = REGIONS[region];
      map.flyTo({ center: meta.center, zoom: meta.zoom, pitch: CITY_PITCH, duration: 1600 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 90, pitch: CITY_PITCH, maxZoom: 16, duration: 1600 });
  }

  // Search → fly to the company. Multi-office: fit all its offices; single: fly in.
  function flyToCompany(companyId: string) {
    const map = mapRef.current;
    const co = state.companies[companyId];
    const pts = offices.filter(o => o.companyId === companyId);
    setQuery('');
    if (co) setSelected({ name: co.name, elo: Math.round(co.elo) });
    if (!map || pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 14, pitch: CITY_PITCH, duration: 1800 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 120, pitch: CITY_PITCH, maxZoom: 14, duration: 1800 });
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(state.companies)
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 8);
  }, [query, state.companies]);

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
        <div className="map-search">
          <input
            className="map-search-input"
            placeholder="Search a company…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <ul className="map-search-results">
              {searchResults.map(c => (
                <li key={c.id}>
                  <button className="map-search-row" onClick={() => flyToCompany(c.id)}>
                    <span className="map-co-name">{c.name}</span>
                    <span className="map-co-elo">{Math.round(c.elo).toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            <p className="map-empty">Pick a city, or search a company to fly there.</p>
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
