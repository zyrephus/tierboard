'use client';

import { useState, useEffect, useRef } from 'react';
import { LEADERBOARDS } from '@/lib/data';
import type { LeaderboardId } from '@/lib/types';

interface LeaderboardPickerProps {
  leaderboardId: LeaderboardId;
  setLeaderboardId: (id: LeaderboardId) => void;
}

export function LeaderboardPicker({ leaderboardId, setLeaderboardId }: LeaderboardPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = LEADERBOARDS.find(board => board.id === leaderboardId) ?? LEADERBOARDS[0];

  return (
    <div className="cohort-picker board-picker" ref={ref}>
      <button className="cohort-btn board-btn" onClick={() => setOpen(o => !o)}>
        <span className="cohort-label">BOARD</span>
        <span className="cohort-value">{current.shortLabel}</span>
        <span className="cohort-chev">{open ? '^' : 'v'}</span>
      </button>
      {open && (
        <div className="cohort-menu board-menu">
          {LEADERBOARDS.map(board => (
            <button
              key={board.id}
              type="button"
              className={`cohort-opt board-opt ${board.id === leaderboardId ? 'active' : ''}`}
              onClick={() => {
                setLeaderboardId(board.id);
                setOpen(false);
              }}
            >
              <span className="board-opt-copy">
                <span>{board.label}</span>
                <span className="board-opt-desc">{board.description}</span>
              </span>
              {board.id === leaderboardId && <span className="cohort-check">*</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
