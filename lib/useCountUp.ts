'use client';

import { useEffect, useRef, useState } from 'react';

// Count a stat up to its value on mount, on the same easeInOutCubic the chart
// tweens its geometry with, so the two motions read as one system. Later value
// changes resume from wherever the counter currently sits.
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = current.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      current.current = start + (target - start) * e;
      setValue(current.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
