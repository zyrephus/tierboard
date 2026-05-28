export function TrendArrow({ value }: { value: number }) {
  const dir = value > 0.5 ? 'up' : value < -0.5 ? 'down' : 'flat';
  const sym = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
  const display = dir === 'flat' ? '0' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  return (
    <span className={`trend trend-${dir}`}>
      <span className="trend-sym">{sym}</span>
      <span className="trend-val">{display}</span>
    </span>
  );
}
