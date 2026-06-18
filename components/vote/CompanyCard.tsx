import { Logo } from '@/components/Logo';
import { SectorPills } from '@/components/SectorPills';
import { effectiveElo } from '@/lib/store';
import type { CompanyState, CohortId } from '@/lib/types';

interface CompanyCardProps {
  company: CompanyState;
  cohort: CohortId;
  side: 'left' | 'right';
  onClick: () => void;
  picked: boolean;
  dimmed: boolean;
  isChampion?: boolean;
}

export function CompanyCard({ company, cohort, onClick, picked, dimmed, side, isChampion }: CompanyCardProps) {
  const elo = effectiveElo(company, cohort);
  const rank = company.rank;
  const trend = company.delta24h || 0;
  return (
    <button
      className={`company-card ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''} side-${side}`}
      onClick={onClick}
      aria-label={`Vote for ${company.name}${isChampion ? ' (reigning champion)' : ''}`}
    >
      <div className="card-top">
        <Logo company={company} size={72} />
        <SectorPills sectorIds={company.sectors} max={3} size="md" />
      </div>
      <div className="card-mid">
        <h2 className="card-name">{company.name}</h2>
        <p className="card-tagline">{company.tagline}</p>
      </div>
      <div className="card-bottom">
        <div className="card-stat">
          <div className="stat-label" aria-label="Points">PTS</div>
          <div className="stat-num">{Math.round(elo)}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">RANK</div>
          <div className="stat-num">#{rank}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">VOTES</div>
          <div className="stat-num">{company.votes.toLocaleString()}</div>
        </div>
        <div className="card-stat">
          <div className="stat-label">24H</div>
          <div className={`stat-num trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}`}>
            {trend > 0.5 ? '+' : ''}{Math.round(trend)}
          </div>
        </div>
      </div>
    </button>
  );
}
