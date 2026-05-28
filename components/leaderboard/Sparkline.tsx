export function Sparkline({ elo, startElo, rankChange }: { elo: number; startElo: number; rankChange: number }) {
  const pct = Math.max(0, Math.min(1, (elo - 1100) / 800));
  const startPct = Math.max(0, Math.min(1, (startElo - 1100) / 800));
  const up = elo >= startElo;
  return (
    <div className="spark-wrap">
      <div className="spark-bar-bg">
        <div className="spark-bar-start" style={{ left: `${startPct * 100}%` }} />
        <div
          className={`spark-bar-fill ${up ? 'up' : 'down'}`}
          style={{ left: `${Math.min(startPct, pct) * 100}%`, width: `${Math.abs(pct - startPct) * 100}%` }}
        />
        <div className="spark-bar-tick" style={{ left: `${pct * 100}%` }} />
      </div>
      <span className={`spark-rank ${rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : 'flat'}`}>
        {rankChange > 0 ? `▲${rankChange}` : rankChange < 0 ? `▼${Math.abs(rankChange)}` : '—'}
      </span>
    </div>
  );
}
