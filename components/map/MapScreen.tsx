'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useOffices, companiesByRegion, REGIONS } from '@/lib/offices';
import { RegionList } from './RegionList';
import { logoTint, monogram } from '@/lib/logo';
import type { StoreState, CompanyState } from '@/lib/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

// Build an HTML marker element mirroring the <Logo> component: a small dot when
// zoomed out, a rounded white logo tile when zoomed in. Plain <img> (no canvas/CORS
// issue), with a monogram fallback exactly like <Logo>.
function setMono(tile: HTMLSpanElement, c: CompanyState) {
  tile.textContent = monogram(c.name);
  tile.classList.add('mono');
  const t = logoTint(c.id);
  tile.style.background = t.bg;
  tile.style.color = t.fg;
  tile.style.borderColor = t.border;
}

function makeMarkerEl(c: CompanyState, onClick: () => void): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'map-marker';
  el.addEventListener('click', onClick);

  const dot = document.createElement('span');
  dot.className = 'map-marker-dot';
  el.appendChild(dot);

  const tile = document.createElement('span');
  tile.className = 'map-marker-logo';
  if (c.logoUrl) {
    const img = document.createElement('img');
    img.src = c.logoUrl;
    img.alt = '';
    if (c.logoUrl.endsWith('.svg')) img.style.padding = '12%';
    img.onerror = () => { tile.replaceChildren(); setMono(tile, c); };
    tile.appendChild(img);
  } else {
    setMono(tile, c);
  }
  el.appendChild(tile);
  return el;
}

export function MapScreen({ state }: { state: StoreState }) {
  const { offices, loading: officesLoading } = useOffices();
  const rankings = useMemo(() => companiesByRegion(state, offices), [state, offices]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
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

  // ── Company markers as HTML elements (real <img> logos, like <Logo>) ───────
  // HTML markers always paint regardless of WebGL image loading / CORS, and match
  // the vote-page logo tile exactly. Dot when zoomed out, logo tile when zoomed in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || officesLoading) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const office of offices) {
      const c = state.companies[office.companyId];
      if (!c) continue;
      const el = makeMarkerEl(c, () => setSelected({ name: c.name, elo: Math.round(c.elo) }));
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([office.lng, office.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Swap dot ↔ logo tile by zoom; only touch the DOM when the threshold flips.
    const NEAR_ZOOM = 11;
    let near = map.getZoom() >= NEAR_ZOOM;
    const setNearClass = () => {
      for (const m of markersRef.current) m.getElement().classList.toggle('near', near);
    };
    const onZoom = () => {
      const n = map.getZoom() >= NEAR_ZOOM;
      if (n !== near) { near = n; setNearClass(); }
    };
    setNearClass();
    map.on('zoom', onZoom);

    return () => {
      map.off('zoom', onZoom);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
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
      // Land right on the company's logo, not a vague city view.
      map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 16, pitch: CITY_PITCH, duration: 1800 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 110, pitch: CITY_PITCH, maxZoom: 15, duration: 1800 });
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
          <div className="lb-search">
            <input
              placeholder="Search a company…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && <button className="clear-btn" onClick={() => setQuery('')}>×</button>}
          </div>
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
              className={`chip ${selectedRegion === r.region ? 'active' : ''}`}
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
