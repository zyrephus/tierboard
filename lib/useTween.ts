'use client';

import { useEffect, useRef, useState } from 'react';

export type Vectors = Record<string, number[]>;

// Animate geometry toward its target, one vector per key. Keyed rather than one
// flat vector so adding or removing a company only snaps that company's line:
// every other line, and the axis, keeps interpolating.
export function useTween(target: Vectors, ms = 600): Vectors {
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
