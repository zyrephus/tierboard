import { logoTint, monogram } from '@/lib/logo';
import { SECTORS } from '@/lib/data';
import type { CompanyState } from '@/lib/types';

interface LogoProps {
  company: Pick<CompanyState, 'id' | 'name'>;
  size?: number;
}

export function Logo({ company, size = 40 }: LogoProps) {
  const tint = logoTint(company.id);
  const m = monogram(company.name);
  const fontSize = size <= 28 ? 11 : size <= 40 ? 14 : size <= 56 ? 18 : 28;
  return (
    <div
      className="logo"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, size * 0.16),
        background: tint.bg,
        color: tint.fg,
        border: `1px solid ${tint.border}`,
        fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {m}
    </div>
  );
}

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
