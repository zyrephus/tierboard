import { logoTint, monogram } from '@/lib/logo';
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
