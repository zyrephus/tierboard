import { SECTORS } from '@/lib/data';

interface SectorPillProps {
  sectorId: string;
  size?: 'sm' | 'md';
}

export function SectorPill({ sectorId, size = 'sm' }: SectorPillProps) {
  const s = SECTORS.find(x => x.id === sectorId);
  if (!s) return null;
  const styles = size === 'sm'
    ? { fontSize: 10, padding: '2px 6px', borderRadius: 3 }
    : { fontSize: 11, padding: '3px 8px', borderRadius: 4 };
  return (
    <span
      className="sector-pill"
      style={{
        ...styles,
        background: s.tint,
        color: s.fg,
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {s.label}
    </span>
  );
}
