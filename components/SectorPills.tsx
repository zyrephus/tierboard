import { SectorPill } from './SectorPill';

interface SectorPillsProps {
  sectorIds: string[];
  size?: 'sm' | 'md';
  max?: number;
}

export function SectorPills({ sectorIds, size = 'sm', max = 2 }: SectorPillsProps) {
  if (!sectorIds?.length) return null;
  const shown = sectorIds.slice(0, max);
  const overflow = sectorIds.length - shown.length;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {shown.map(id => <SectorPill key={id} sectorId={id} size={size} />)}
      {overflow > 0 && (
        <span
          title={sectorIds.slice(max).join(', ')}
          style={{
            fontSize: size === 'sm' ? 10 : 11,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
