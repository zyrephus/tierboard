'use client';

import { useState, useEffect, useRef } from 'react';
import { COHORTS } from '@/lib/data';
import type { CohortId } from '@/lib/types';

export function CohortPicker({ cohort }: { cohort: CohortId; setCohort: (c: CohortId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = COHORTS.find(c => c.id === cohort);
  return (
    <div className="cohort-picker" ref={ref}>
      <button className="cohort-btn" onClick={() => setOpen(o => !o)}>
        <span className="cohort-label">COHORT</span>
        <span className="cohort-value">{current?.label}</span>
        <span className="cohort-chev">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cohort-menu">
          {COHORTS.map(c => (
            <div
              key={c.id}
              className={`cohort-opt cohort-opt--disabled ${c.id === cohort ? 'active' : ''}`}
            >
              <span>{c.label}</span>
              {c.id === cohort && <span className="cohort-check">✓</span>}
            </div>
          ))}
          <div className="cohort-foot">Cohort breakdowns coming soon.</div>
        </div>
      )}
    </div>
  );
}
