'use client';

import { useMemo, useState } from 'react';
import { useEloHistory, useEarliestSnapshot } from '@/lib/useEloHistory';
import { useTween, type Vectors } from '@/lib/useTween';
import { RANGES, RANGE_DAYS, monotoneSampler, polyPath, fmtTick, type RangeKey } from '@/lib/chart';

const W = 720, H = 200, PAD = { t: 12, r: 12, b: 22, l: 44 };
const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b;
const N = 128; // samples — a fixed count is what makes the line tweenable
const LINE = 'line', AXIS = '__axis';

// Owned by the page rather than the chart so the page can hold the whole card
// as a skeleton until the history has arrived too.
export function useCompanyHistory(companyId: string) {
  const [range, setRange] = useState<RangeKey>('1W');
  const { series, loading, error } = useEloHistory([companyId], range);
  const earliest = useEarliestSnapshot();
  return { range, setRange, series, loading, error, earliest };
}

export type CompanyHistory = ReturnType<typeof useCompanyHistory>;

export function PrestigeHistory({ history }: { history: CompanyHistory }) {
  const { range, setRange, series, loading, error, earliest } = history;
  const points = series[0]?.points ?? [];

  const available = (r: RangeKey) =>
    earliest == null || RANGE_DAYS[r] === Infinity || Date.now() - earliest >= RANGE_DAYS[r] * 864e5;

  // Sampled y at a fixed x grid, plus the y-scale under its own key so the axis
  // labels roll on the same clock as the line — same shape the main chart uses.
  const { targets, span } = useMemo(() => {
    if (points.length < 2) return { targets: {} as Vectors, span: null };
    const ts = points.map(p => p.t), elos = points.map(p => p.elo);
    const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
    const padv = Math.max(4, (Math.max(...elos) - Math.min(...elos)) * 0.15);
    const [lo, hi] = [Math.min(...elos) - padv, Math.max(...elos) + padv];

    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * PW;
    const y = (e: number) => PAD.t + (1 - (e - lo) / (hi - lo || 1)) * PH;
    const at = monotoneSampler(points.map(p => ({ x: x(p.t), y: y(p.elo) })));
    const ys = Array.from({ length: N }, (_, i) => at(PAD.l + (i / (N - 1)) * PW));

    return { targets: { [LINE]: ys, [AXIS]: [lo, hi] }, span: { t0, t1, rising: elos[elos.length - 1] >= elos[0] } };
  }, [points]);

  const tw = useTween(targets);

  let body;
  if (error) {
    body = <div className="co-chart-empty">History unavailable.</div>;
  } else if (loading) {
    body = <div className="skeleton" style={{ height: H }} />;
  } else if (!span) {
    body = <div className="co-chart-empty">Not enough history in this window yet.</div>;
  } else {
    const ys = tw[LINE] ?? targets[LINE];
    const [lo, hi] = tw[AXIS] ?? targets[AXIS];
    const path = polyPath(ys.map((y, i) => ({ x: PAD.l + (i / (N - 1)) * PW, y })));

    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className="co-chart-svg" role="img" aria-label="Prestige history">
        {[1, 0.5, 0].map(f => {
          const y = PAD.t + (1 - f) * PH;
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="co-grid" />
              <text x={PAD.l - 6} y={y + 3} className="co-axis" textAnchor="end">
                {Math.round(lo + (hi - lo) * f)}
              </text>
            </g>
          );
        })}
        <text x={PAD.l} y={H - 6} className="co-axis">{fmtTick(span.t0, range)}</text>
        <text x={W - PAD.r} y={H - 6} className="co-axis" textAnchor="end">{fmtTick(span.t1, range)}</text>
        <path d={path} className={`co-line ${span.rising ? 'up' : 'down'}`} />
      </svg>
    );
  }

  return (
    <section className="co-section">
      <div className="co-chart-head">
        <h2 className="co-section-title">Prestige history</h2>
        <div className="co-ranges">
          {RANGES.map(r => (
            <button
              key={r}
              className={`co-range ${r === range ? 'active' : ''}`}
              disabled={!available(r)}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {body}
    </section>
  );
}
