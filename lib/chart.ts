import { hashStr } from './logo';

export type RangeKey = '1D' | '1W' | '3M' | '1Y' | 'ALL';
export const RANGES: RangeKey[] = ['1D', '1W', '3M', '1Y', 'ALL'];
export const RANGE_DAYS: Record<RangeKey, number> = {
  '1D': 1, '1W': 7, '3M': 90, '1Y': 365, ALL: Infinity,
};
export const MAX_LINES = 6;

// A line's color is the company's deterministic monogram hue, but rotated out of
// the green (110–160) and red (10–40) bands so a line never reads as a delta color.
export function lineColor(id: string): string {
  let hue = hashStr(id) % 360;
  if (hue >= 110 && hue <= 160) hue = hue < 135 ? 105 : 165;
  if (hue >= 10 && hue <= 40) hue = hue < 25 ? 5 : 45;
  return `oklch(0.52 0.15 ${hue})`;
}

export interface SeriesPoint { t: number; elo: number } // t = epoch ms
export interface Series { companyId: string; points: SeriesPoint[] }

// Monotone cubic (Fritsch–Carlson) interpolant through points already mapped to
// x/y, as a function of x. Monotone specifically: it never overshoots, so it
// won't invent peaks the data doesn't contain — honest smoothing for sparse
// hourly points. Returning a sampler rather than a path keeps the nonlinear
// tangent fit out of the render loop, so sampled curves stay tweenable.
export function monotoneSampler(pts: { x: number; y: number }[]): (x: number) => number {
  const n = pts.length;
  if (n === 1) return () => pts[0].y;
  if (n === 2) {
    const [a, b] = pts;
    return x => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }

  const dx: number[] = [], slope: number[] = [], tan: number[] = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  tan[0] = slope[0];
  tan[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tan[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i] / slope[i], b = tan[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const f = 3 / Math.sqrt(s);
      tan[i] = f * a * slope[i];
      tan[i + 1] = f * b * slope[i];
    }
  }
  return (x: number) => {
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[n - 1].x) return pts[n - 1].y;
    let i = 0;
    while (i < n - 2 && pts[i + 1].x < x) i++;
    const t = (x - pts[i].x) / dx[i], t2 = t * t, t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * pts[i].y +
      (t3 - 2 * t2 + t) * dx[i] * tan[i] +
      (-2 * t3 + 3 * t2) * pts[i + 1].y +
      (t3 - t2) * dx[i] * tan[i + 1]
    );
  };
}

// Polyline through densely sampled points — smooth enough at sample spacing of
// a few pixels, and linear in its inputs so it can be interpolated frame by frame.
export function polyPath(pts: { x: number; y: number }[]): string {
  return 'M' + pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L');
}

// X-axis tick label for a timestamp given the active range.
export function fmtTick(ms: number, range: RangeKey): string {
  const d = new Date(ms);
  if (range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
