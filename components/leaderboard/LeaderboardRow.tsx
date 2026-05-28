import { Logo } from '@/components/Logo';
import { SectorPills } from '@/components/SectorPills';
import { TrendArrow } from './TrendArrow';
import { Sparkline } from './Sparkline';
import type { RowData } from './types';

function tierFor(elo: number): string {
  if (elo >= 1750) return 'S';
  if (elo >= 1600) return 'A';
  if (elo >= 1450) return 'B';
  if (elo >= 1300) return 'C';
  return 'D';
}

export function LeaderboardRow({ c, showTrend, gridCols }: { c: RowData; showTrend: boolean; gridCols: string }) {
  const trend = c.delta24h || 0;
  const rankChange = c.rankPrev != null ? c.rankPrev - (c.rank ?? c.rankPrev) : 0;
  const tierBadge = tierFor(c.effElo);
  return (
    <div className="lb-row" style={{ gridTemplateColumns: gridCols }}>
      <div className="cell cell-rank">
        <span className="rank-num">{c.displayRank}</span>
        <span className={`tier-badge tier-${tierBadge}`}>{tierBadge}</span>
      </div>
      <div className="cell cell-company">
        <Logo company={c} size={28} />
        <div className="row-info">
          <span className="row-name">{c.name}</span>
          <span className="row-tag">{c.tagline}</span>
        </div>
      </div>
      <div className="cell cell-sector">
        <SectorPills sectorIds={c.sectors} />
      </div>
      <div className="cell cell-elo">
        <span className="elo-num">{Math.round(c.effElo)}</span>
      </div>
      {showTrend && (
        <div className="cell cell-trend">
          <TrendArrow value={trend} />
        </div>
      )}
      <div className="cell cell-votes">
        <span className="votes-num">{c.votes.toLocaleString()}</span>
      </div>
      <div className="cell cell-spark">
        <Sparkline elo={c.effElo} startElo={c.startingElo} rankChange={rankChange} />
      </div>
    </div>
  );
}
