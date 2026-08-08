'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { TrendArrow } from '@/components/leaderboard/TrendArrow';
import { useShell } from '@/components/Shell';
import { useEloHistory, useEarliestSnapshot } from '@/lib/useEloHistory';
import {
  RANGES, RANGE_DAYS, MAX_LINES, lineColor, monotoneSampler, polyPath, fmtTick,
  type RangeKey, type Series,
} from '@/lib/chart';
import { monogram } from '@/lib/logo';
import type { StoreState } from '@/lib/types';

const DAY = 86_400_000;
const SEED_LINES = 5;

// n distinct company ids, uniformly at random. Sorting by a random key rather
// than a random comparator, which is a biased shuffle.
function randomIds(companies: StoreState['companies'], n: number, exclude: string[] = []) {
  return Object.keys(companies)
    .filter(id => !exclude.includes(id))
    .map(id => ({ id, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map(c => c.id);
}

export function ChartScreen({ state }: { state: StoreState }) {
  // Selection and range live in Shell so they persist across navigation.
  // chartSelected === null means "not yet initialized" (vs [] = user cleared it).
  const { chartSelected, setChartSelected, chartRange: range, setChartRange: setRange } = useShell();
  const selected = chartSelected ?? [];
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');

  const earliest = useEarliestSnapshot();
  const { series, shownRange, loading, error } = useEloHistory(selected, range, nonce);

  // Initialize selection from ?company= deep-link, else 5 random companies.
  // Runs once: on later mounts chartSelected is already set, so this is a no-op.
  useEffect(() => {
    if (chartSelected !== null || !state.loaded) return;
    if (Object.keys(state.companies).length === 0) return;
    const param = new URLSearchParams(window.location.search).get('company');
    const fromUrl = (param ? param.split(',') : []).filter(id => state.companies[id]);
    setChartSelected(
      fromUrl.length ? fromUrl.slice(0, MAX_LINES) : randomIds(state.companies, SEED_LINES),
    );
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
  // Always a full fresh five, whatever is on the board now, and never the ones
  // already showing — a reroll that repeats itself doesn't look like a reroll.
  const shuffle = () => setChartSelected(randomIds(state.companies, SEED_LINES, selected));

  return (
    <div className="chart-screen">
      <section className="card chart-card" aria-label="Points history chart">
        {selected.length === 0 ? (
          <div className="chart-empty">
            <p>No companies selected.</p>
            <p className="muted">Add a company from the watchlist to plot its prestige over time.</p>
          </div>
        ) : error ? (
          <div className="chart-empty">
            <p>Couldn&apos;t load history.</p>
            <button className="chip" onClick={() => setNonce(n => n + 1)}>Retry</button>
          </div>
        ) : loading && series.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <PrestigeChart series={series} state={state} range={shownRange} />
        )}

        <footer className="chart-foot">
          <div className="range-tabs" role="tablist" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                disabled={!rangeAvailable(r)}
                title={undefined}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </footer>
      </section>

      <aside className="card watchlist" aria-label="Watchlist">
        <div className="whead">
          <h3>Watchlist</h3>
          <button className="chip wshuffle" onClick={shuffle} disabled={!state.loaded}>
            Shuffle
          </button>
        </div>
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
                <div className="welo" aria-label="Points">{c.elo.toFixed(0)}</div>
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
                      <span className="wadd-elo" aria-label="Points">{c.elo.toFixed(0)}</span>
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
const N = 128; // samples per line — a fixed count is what makes lines tweenable

const EXIT_MS = 320;
const AXIS = '__axis'; // tween key for [lo, hi]; company ids never collide with it

type Vectors = Record<string, number[]>;

// Animate geometry toward its target, one vector per key. Keyed rather than one
// flat vector so adding or removing a company only snaps that company's line:
// every other line, and the axis, keeps interpolating.
function useTween(target: Vectors, ms = 600): Vectors {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = current.current;
    if (reduced) { current.current = target; setValue(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const next: Vectors = {};
      for (const [id, to] of Object.entries(target)) {
        const a = from[id];
        next[id] = a?.length === to.length ? to.map((v, i) => a[i] + (v - a[i]) * e) : to;
      }
      current.current = next;
      setValue(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

// Geometry of lines that just left the selection, held at their last shape for
// one fade so a removal reads as a departure rather than a disappearance.
function useExiting(target: Vectors): Vectors {
  const [exiting, setExiting] = useState<Vectors>({});
  const prev = useRef<Vectors>({});
  // Each departure owns its own timer, cleared only on unmount. Tying them to
  // the effect's cleanup would let a second removal cancel the first one's
  // sweep and strand its line in the DOM at zero opacity.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const before = prev.current;
    prev.current = target;
    const gone = Object.keys(before).filter(id => !(id in target));
    if (gone.length === 0) return;
    setExiting(e => ({ ...e, ...Object.fromEntries(gone.map(id => [id, before[id]])) }));
    timers.current.push(setTimeout(() => {
      setExiting(e => Object.fromEntries(Object.entries(e).filter(([id]) => !gone.includes(id))));
    }, EXIT_MS));
  }, [target]);
  return exiting;
}

const pairs = (v: number[]) =>
  Array.from({ length: v.length / 2 }, (_, i) => ({ x: v[i * 2], y: v[i * 2 + 1] }));


function PrestigeChart({ series, state, range }: { series: Series[]; state: StoreState; range: RangeKey }) {
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
      if (pts.length === 0) return { id: s.companyId, pts, coords: [] };
      const raw = pts.map(p => ({ x: x(p.t), y: y(p.elo) }));
      const at = monotoneSampler(raw);
      const x0 = raw[0].x, x1 = Math.max(raw[raw.length - 1].x, x0 + 1);
      const coords = Array.from({ length: N }, (_, i) => {
        const px = x0 + ((x1 - x0) * i) / (N - 1);
        return { x: px, y: at(px) };
      });
      return { id: s.companyId, pts, coords };
    }).filter(l => l.pts.length > 0);

    const yTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    const xTicks = Array.from({ length: 4 }, (_, i) => start + ((end - start) * i) / 3);
    const union = Array.from(new Set(series.flatMap(s => s.points.filter(p => p.t >= start).map(p => p.t)))).sort((a, b) => a - b);
    return { start, end, lo, hi, x, y, lines, yTicks, xTicks, union };
  }, [series, range, W]);

  // One vector per line as [x0, y0, x1, y1, …], plus the y-scale under a key of
  // its own so the rolling axis labels animate on the same clock.
  const targets = useMemo(() => {
    const t: Vectors = {};
    if (!geo) return t;
    t[AXIS] = [geo.lo, geo.hi];
    for (const l of geo.lines) t[l.id] = l.coords.flatMap(c => [c.x, c.y]);
    return t;
  }, [geo]);

  const exiting = useExiting(targets);
  const tweenTarget = useMemo(() => ({ ...exiting, ...targets }), [exiting, targets]);
  const tw = useTween(tweenTarget);
  const [lo, hi] = tw[AXIS] ?? targets[AXIS] ?? [0, 0];

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
        aria-label={`Points history for ${names.join(', ')}, ${range}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverTs(null)}
      >
        {/* gridlines + y labels (Points values) */}
        {geo.yTicks.map((_, i) => {
          const gy = PAD.t + PH * (1 - i / 4);
          return (
            <g key={i}>
              <line className="grid-line" x1={PAD.l} y1={gy} x2={PAD.l + PW} y2={gy} />
              <text className="axis-label" x={PAD.l - 8} y={gy + 3} textAnchor="end">
                {(lo + ((hi - lo) * i) / 4).toFixed(0)}
              </text>
            </g>
          );
        })}
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

        {/* lines on their way out — path only, no marker or label */}
        {Object.keys(exiting).filter(id => !(id in targets)).map(id => (
          <path key={`exit-${id}`} className="line-exit" fill="none" strokeWidth={1.5}
            stroke={lineColor(id)} d={polyPath(pairs(tw[id] ?? exiting[id]))} />
        ))}

        {/* lines + endpoint markers */}
        {geo.lines.map(l => {
          const coords = pairs(tw[l.id] ?? targets[l.id]);
          const last = coords[coords.length - 1];
          const lastElo = lo + (1 - (last.y - PAD.t) / PH) * (hi - lo);
          return (
            <g className="line-enter" key={l.id}>
              <path d={polyPath(coords)} fill="none" stroke={lineColor(l.id)} strokeWidth={1.5} />
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
        <caption>Points history, {range}</caption>
        <thead><tr><th>Company</th><th>Points</th></tr></thead>
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
