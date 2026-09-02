import type { CompanyState } from './types';

// Bradley-Terry win probability from two Prestige Index values.
// recompute_rankings() publishes elo = 1500 + 120*log10(p), so
// log10(p_a/p_b) = (elo_a - elo_b)/120 and P(a beats b) = 1/(1 + 10^-(delta/120)).
// The 120 is the index scale — the chess 400 would flatten every matchup.
export const INDEX_SCALE = 120;

export function winProbability(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, -(eloA - eloB) / INDEX_SCALE));
}

// A company is only ranked once the hourly batch has scored it; until then its
// elo is the 1500 default and would sit mid-pack on nothing.
export const isRanked = (c: CompanyState) => c.games > 0;

export interface SectorStanding {
  sectorId: string;
  rank: number;
  total: number;
}

export function sectorStandings(
  company: CompanyState,
  companies: Record<string, CompanyState>,
): SectorStanding[] {
  const ranked = Object.values(companies).filter(isRanked);
  return company.sectors.map(sectorId => {
    const peers = ranked
      .filter(c => c.sectors.includes(sectorId))
      .sort((a, b) => b.elo - a.elo || (a.id < b.id ? -1 : 1));
    return {
      sectorId,
      rank: peers.findIndex(c => c.id === company.id) + 1,
      total: peers.length,
    };
  });
}

// Nearest-elo ranked peers, preferring companies that share a sector. These are
// the matchups worth predicting — a coin-flip against a peer beats a 99% romp.
export function closestPeers(
  company: CompanyState,
  companies: Record<string, CompanyState>,
  limit = 6,
): CompanyState[] {
  const ranked = Object.values(companies).filter(c => isRanked(c) && c.id !== company.id);
  const shared = ranked.filter(c => c.sectors.some(s => company.sectors.includes(s)));
  const pool = shared.length >= limit ? shared : ranked;
  return pool
    .sort((a, b) => Math.abs(a.elo - company.elo) - Math.abs(b.elo - company.elo))
    .slice(0, limit);
}
