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

// Monotone cubic (Fritsch–Carlson) path through points already mapped to x/y.
// Monotone specifically: it never overshoots, so it won't invent peaks the data
// doesn't contain — honest smoothing for sparse hourly points.
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

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
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i].x + dx[i] / 3, y1 = pts[i].y + (tan[i] * dx[i]) / 3;
    const x2 = pts[i + 1].x - dx[i] / 3, y2 = pts[i + 1].y - (tan[i + 1] * dx[i]) / 3;
    d += ` C${x1},${y1} ${x2},${y2} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

// X-axis tick label for a timestamp given the active range.
export function fmtTick(ms: number, range: RangeKey): string {
  const d = new Date(ms);
  if (range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
