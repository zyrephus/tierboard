import type { CompanyState } from '@/lib/types';

export interface RowData extends CompanyState {
  effElo: number;
  displayRank: number;
}
