import type { RegionRanking } from '@/lib/offices';

/**
 * Renders region sections, each with its top companies ranked by Points.
 * Reused two ways: the full list is the map's fallback view (when Mapbox can't
 * load), and a single-region slice is the side panel when a metro is selected.
 */
export function RegionList({ rankings, limit = 5 }: { rankings: RegionRanking[]; limit?: number }) {
  if (rankings.length === 0) {
    return <p className="map-empty">Not enough companies mapped yet.</p>;
  }
  return (
    <div className="map-regions">
      {rankings.map(r => (
        <section key={r.region} className="map-region">
          <h3 className="map-region-title">{r.label}</h3>
          <ol className="map-region-list">
            {r.companies.slice(0, limit).map((c, i) => (
              <li key={c.id} className="map-region-row">
                <span className="map-rank">{i + 1}</span>
                <span className="map-co-name">{c.name}</span>
                <span className="map-co-elo">{Math.round(c.elo).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
