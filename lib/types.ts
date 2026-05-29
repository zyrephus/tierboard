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
export type LeaderboardId = 'prestige' | 'work_life_balance' | 'benefits_compensation' | 'impact';

export interface LeaderboardDefinition {
  id: LeaderboardId;
  label: string;
  shortLabel: string;
  prompt: string;
  description: string;
}

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
}

export interface CompanyState extends CompanyBase {
  delta24h: number;
  rankPrev: number | null;
  rank: number | null;
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
}
