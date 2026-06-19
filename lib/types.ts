export interface Sector {
  id: string;
  label: string;
  tint: string;
  fg: string;
}

export interface Cohort {
  id: string;
  label: string;
}

export type CohortId = 'all' | 'swe' | 'pm' | 'quant' | 'design' | 'newgrad' | 'senior';

export interface CompanyBase {
  id: string;
  name: string;
  tagline: string;
  sectors: string[];
  elo: number;
  startingElo: number;
  votes: number;
  wins: number;
  losses: number;
  logoUrl: string | null;
  games: number;
  indexSe?: number;
}

export interface CompanyState extends CompanyBase {
  delta24h: number;
  rankPrev: number | null;
  rank: number | null;
}

export interface Office {
  id: number;
  companyId: string;      // matches CompanyState.id
  label: string | null;
  city: string;
  region: string | null;  // curated metro key (see REGIONS) or null
  country: string | null;
  lat: number;
  lng: number;
  isHq: boolean;
}

export interface VoteHistoryEntry {
  winner: string;
  loser: string;
  delta: number;
  ts: number;
}

export interface StoreState {
  companies: Record<string, CompanyState>;
  sectors: Sector[];
  totalVotes: number;
  userVotes: number;
  history: VoteHistoryEntry[];
  loaded: boolean;
  // First matchup, picked at load time so its two logos can be preloaded
  // before first paint. Shell consumes this for the opening vote pair.
  initialPair: [string, string] | null;
}
