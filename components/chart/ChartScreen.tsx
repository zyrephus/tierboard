'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { TrendArrow } from '@/components/leaderboard/TrendArrow';
import { useShell } from '@/components/Shell';
import { useEloHistory, useEarliestSnapshot } from '@/lib/useEloHistory';
import {
  RANGES, RANGE_DAYS, MAX_LINES, lineColor, monotonePath, fmtTick,
  type RangeKey, type Series,
} from '@/lib/chart';
import { monogram } from '@/lib/logo';
import type { StoreState } from '@/lib/types';

const DAY = 86_400_000;

export function ChartScreen({ state }: { state: StoreState }) {
  // Selection and range live in Shell so they persist across navigation.
  // chartSelected === null means "not yet initialized" (vs [] = user cleared it).
  const { chartSelected, setChartSelected, chartRange: range, setChartRange: setRange } = useShell();
  const selected = chartSelected ?? [];
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');

  const earliest = useEarliestSnapshot();
  const { series, loading, error } = useEloHistory(selected, range, nonce);

  // Initialize selection from ?company= deep-link, else the current top 3 by ELO.
  // Runs once: on later mounts chartSelected is already set, so this is a no-op.
  useEffect(() => {
    if (chartSelected !== null || !state.loaded) return;
    const ids = Object.values(state.companies);
    if (ids.length === 0) return;
    const param = new URLSearchParams(window.location.search).get('company');
    const fromUrl = (param ? param.split(',') : []).filter(id => state.companies[id]);
    const top = ids.sort((a, b) => b.elo - a.elo).slice(0, 3).map(c => c.id);
    setChartSelected(fromUrl.length ? fromUrl.slice(0, MAX_LINES) : top);
  }, [state.loaded, state.companies, chartSelected, setChartSelected]);

  // A range is available once we have history at least as old as its window.
  const spanDays = earliest ? (Date.now() - earliest) / DAY : 0;
  const rangeAvailable = (r: RangeKey) =>
    r === '1D' || r === 'ALL' || (earliest != null && spanDays >= RANGE_DAYS[r]);

  // If the active range becomes unavailable (shouldn't happen), fall back to 1D.
  useEffect(() => {
    if (!rangeAvailable(range)) setRange('1D');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earliest]);

  const sectorLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of state.sectors) m[s.id] = s.label;
    return m;
  }, [state.sectors]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(state.companies)
      .filter(c => !selected.includes(c.id) && c.name.toLowerCase().includes(q))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 8);
  }, [query, state.companies, selected]);

  const add = (id: string) => {
    if (selected.length >= MAX_LINES || selected.includes(id)) return;
    setChartSelected([...selected, id]);
    setQuery('');
  };
  const remove = (id: string) => setChartSelected(selected.filter(s => s !== id));

  return (
    <div className="chart-screen">
      <section className="card chart-card" aria-label="ELO history chart">
        {selected.length === 0 ? (
          <div className="chart-empty">
            <p>No companies selected.</p>
            <p className="muted">Add a company from the watchlist to plot its prestige over time.</p>
          </div>
        ) : error ? (
          <div className="chart-empty">
            <p>Couldn’t load history.</p>
            <button className="chip" onClick={() => setNonce(n => n + 1)}>Retry</button>
          </div>
        ) : loading ? (
          <ChartSkeleton />
        ) : (
          <EloChart series={series} state={state} range={range} />
        )}

        <footer className="chart-foot">
          <div className="range-tabs" role="tablist" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                disabled={!rangeAvailable(r)}
                title={rangeAvailable(r) ? undefined
                  : earliest ? `tracking since ${new Date(earliest).toLocaleDateString()}` : ''}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          {earliest && (
            <div className="range-hint">
              tracking since {new Date(earliest).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              {' · longer ranges unlock as data grows'}
            </div>
          )}
        </footer>
      </section>

      <aside className="card watchlist" aria-label="Watchlist">
        <h3>Watchlist</h3>
        {selected.map(id => {
          const c = state.companies[id];
          if (!c) return null;
          return (
            <div className="wrow" key={id}>
              <span className="wswatch" style={{ background: lineColor(id) }} aria-hidden />
              <Logo company={c} size={24} />
              <div className="wmeta">
                <div className="wname">{c.name}</div>
                <div className="wsector">{c.sectors.map(s => sectorLabel[s] ?? s).slice(0, 1).join('')}</div>
              </div>
              <div className="wval">
                <div className="welo">{c.elo.toFixed(0)}</div>
                <TrendArrow value={c.delta24h} />
              </div>
              <button className="wremove" aria-label={`Remove ${c.name}`} onClick={() => remove(id)}>×</button>
            </div>
          );
        })}

        {selected.length < MAX_LINES ? (
          <div className="wadd">
            <input
              className="wadd-input"
              placeholder="+ Add company"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Add a company to the chart"
            />
            {matches.length > 0 && (
              <ul className="wadd-list">
                {matches.map(c => (
                  <li key={c.id}>
                    <button onClick={() => add(c.id)}>
                      <Logo company={c} size={18} />
                      <span>{c.name}</span>
                      <span className="wadd-elo">{c.elo.toFixed(0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="wadd-max">Comparing {MAX_LINES} — remove one to add another</div>
        )}
      </aside>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="chart-skeleton" aria-busy="true" aria-label="Loading chart">
      <svg viewBox="0 0 760 320" preserveAspectRatio="none">
        {[16, 84, 152, 220, 288].map(y => (
          <line key={y} x1="48" y1={y} x2="696" y2={y} stroke="var(--border)" />
        ))}
      </svg>
    </div>
  );
}

const H = 320;
const PAD = { l: 48, r: 64, t: 16, b: 28 };

function EloChart({ series, state, range }: { series: Series[]; state: StoreState; range: RangeKey }) {
  const [hoverTs, setHoverTs] = useState<number | null>(null);
  const [width, setWidth] = useState(760);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Render at the container's real pixel width so 1 user unit = 1px. A fixed
  // viewBox scaled with width:100% shrank the graph on mobile while CSS-px text
  // stayed put, making labels look oversized; measuring keeps everything true-size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setWidth(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(width, 280);
  const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b;

  const geo = useMemo(() => {
    const now = Date.now();
    const allPts = series.flatMap(s => s.points);
    if (allPts.length === 0) return null;
    const minT = Math.min(...allPts.map(p => p.t));
    const start = range === 'ALL' ? minT : Math.max(minT, now - RANGE_DAYS[range] * DAY);
    const end = now;
    const vis = allPts.filter(p => p.t >= start);
    const elos = (vis.length ? vis : allPts).map(p => p.elo);
    let lo = Math.min(...elos), hi = Math.max(...elos);
    const padv = Math.max(8, (hi - lo) * 0.08);
    lo -= padv; hi += padv;

    const x = (t: number) => PAD.l + ((t - start) / (end - start || 1)) * PW;
    const y = (e: number) => PAD.t + (1 - (e - lo) / (hi - lo || 1)) * PH;

    const lines = series.map(s => {
      const pts = s.points.filter(p => p.t >= start).sort((a, b) => a.t - b.t);
      return { id: s.companyId, pts, coords: pts.map(p => ({ x: x(p.t), y: y(p.elo) })) };
    }).filter(l => l.pts.length > 0);

    const yTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    const xTicks = Array.from({ length: 4 }, (_, i) => start + ((end - start) * i) / 3);
    const union = Array.from(new Set(series.flatMap(s => s.points.filter(p => p.t >= start).map(p => p.t)))).sort((a, b) => a - b);
    return { start, end, lo, hi, x, y, lines, yTicks, xTicks, union };
  }, [series, range, W]);

  if (!geo) {
    return <div className="chart-empty"><p className="muted">No data in this range yet.</p></div>;
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = geo.union[0], best = Infinity;
    for (const t of geo.union) {
      const d = Math.abs(geo.x(t) - vbX);
      if (d < best) { best = d; nearest = t; }
    }
    setHoverTs(nearest);
  };

  const valueAt = (s: Series, ts: number): number | null => {
    if (s.points.length === 0) return null;
    let best = s.points[0], bd = Infinity;
    for (const p of s.points) {
      const d = Math.abs(p.t - ts);
      if (d < bd) { bd = d; best = p; }
    }
    return best.elo;
  };

  const names = series.map(s => state.companies[s.companyId]?.name ?? s.companyId);
  const hoverX = hoverTs != null ? geo.x(hoverTs) : 0;
  const tipLeft = hoverX > PAD.l + PW / 2;

  return (
    <div className="chart-plot" ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`ELO history for ${names.join(', ')}, ${range}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverTs(null)}
      >
        {/* gridlines + y labels */}
        {geo.yTicks.map((e, i) => (
          <g key={i}>
            <line className="grid-line" x1={PAD.l} y1={geo.y(e)} x2={PAD.l + PW} y2={geo.y(e)} />
            <text className="axis-label" x={PAD.l - 8} y={geo.y(e) + 3} textAnchor="end">{e.toFixed(0)}</text>
          </g>
        ))}
        {/* x labels */}
        {geo.xTicks.map((t, i) => (
          <text key={i} className="axis-label" x={geo.x(t)} y={H - 10}
            textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}>
            {fmtTick(t, range)}
          </text>
        ))}

        {/* crosshair */}
        {hoverTs != null && (
          <line className="crosshair" x1={hoverX} y1={PAD.t} x2={hoverX} y2={PAD.t + PH} />
        )}

        {/* lines + endpoint markers */}
        {geo.lines.map(l => {
          const last = l.coords[l.coords.length - 1];
          const lastElo = l.pts[l.pts.length - 1].elo;
          return (
            <g key={l.id}>
              <path d={monotonePath(l.coords)} fill="none" stroke={lineColor(l.id)} strokeWidth={1.5} />
              <circle cx={last.x} cy={last.y} r={3} fill={lineColor(l.id)} stroke="var(--bg-elev)" strokeWidth={1.5} />
              <text className="endpoint-label" x={last.x + 7} y={last.y + 3} fill={lineColor(l.id)}>
                {monogram(state.companies[l.id]?.name ?? l.id)} {lastElo.toFixed(0)}
              </text>
              {hoverTs != null && (
                <circle cx={hoverX} cy={geo.y(valueAt(series.find(s => s.companyId === l.id)!, hoverTs)!)}
                  r={2.5} fill={lineColor(l.id)} />
              )}
            </g>
          );
        })}

        {/* tooltip */}
        {hoverTs != null && (
          <g transform={`translate(${tipLeft ? hoverX - 162 : hoverX + 12}, ${PAD.t + 6})`}>
            <rect className="tip" width={150} height={30 + series.length * 16} rx={7} />
            <text className="tip-date" x={10} y={16}>{new Date(hoverTs).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</text>
            {series.map((s, i) => (
              <text key={s.companyId} className="tip-row" x={10} y={36 + i * 16}>
                <tspan fill={lineColor(s.companyId)}>●</tspan>
                <tspan fill="var(--text)"> {monogram(state.companies[s.companyId]?.name ?? s.companyId)}</tspan>
                <tspan x={140} textAnchor="end" fill="var(--text)" fontWeight={500}>{(valueAt(s, hoverTs) ?? 0).toFixed(0)}</tspan>
              </text>
            ))}
          </g>
        )}
      </svg>

      {/* screen-reader data table */}
      <table className="sr-only">
        <caption>ELO history, {range}</caption>
        <thead><tr><th>Company</th><th>Latest ELO</th></tr></thead>
        <tbody>
          {series.map(s => (
            <tr key={s.companyId}>
              <td>{state.companies[s.companyId]?.name ?? s.companyId}</td>
              <td>{(s.points[s.points.length - 1]?.elo ?? 0).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
