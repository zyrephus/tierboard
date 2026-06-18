'use client';

import { useState, useEffect, useRef } from 'react';
import type { Sector } from '@/lib/types';

interface Props {
  sectors: Sector[];
  value: string;
  onChange: (id: string) => void;
}

export function SectorDropdown({ sectors, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = value === 'all' ? 'All sectors' : (sectors.find(s => s.id === value)?.label ?? 'All sectors');

  return (
    <div className="cohort-picker" ref={ref}>
      <button className="lb-suggest-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setOpen(o => !o)}>
        <span>{current}</span>
        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cohort-menu">
          <button
            className={`cohort-opt ${value === 'all' ? 'active' : ''}`}
            onClick={() => { onChange('all'); setOpen(false); }}
          >
            <span>All sectors</span>
            {value === 'all' && <span className="cohort-check">✓</span>}
          </button>
          {sectors.map(s => (
            <button
              key={s.id}
              className={`cohort-opt ${s.id === value ? 'active' : ''}`}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >
              <span>{s.label}</span>
              {s.id === value && <span className="cohort-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
