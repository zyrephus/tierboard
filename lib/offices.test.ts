import { describe, it, expect } from 'vitest';
import { companiesByRegion } from './offices';
import type { CompanyState, StoreState, Office } from './types';

function company(id: string, elo: number): CompanyState {
  return {
    id,
    name: id,
    tagline: '',
    sectors: [],
    elo,
    startingElo: elo,
    votes: 0,
    wins: 0,
    losses: 0,
    logoUrl: null,
    games: 0,
    delta24h: 0,
    rankPrev: null,
    rank: null,
  };
}

function storeOf(...companies: CompanyState[]): StoreState {
  const map: Record<string, CompanyState> = {};
  for (const c of companies) map[c.id] = c;
  return {
    companies: map,
    sectors: [],
    totalVotes: 0,
    userVotes: 0,
    history: [],
    loaded: true,
    initialPair: null,
  };
}

let officeId = 0;
function office(companyId: string, region: string | null): Office {
  return {
    id: ++officeId,
    companyId,
    label: null,
    city: region ?? 'nowhere',
    region,
    country: null,
    lat: 0,
    lng: 0,
    isHq: false,
  };
}

describe('companiesByRegion', () => {
  it('groups companies by region and sorts by elo desc', () => {
    const state = storeOf(company('a', 1500), company('b', 1700), company('c', 1600));
    const offices = [office('a', 'bay'), office('b', 'bay'), office('c', 'bay')];

    const result = companiesByRegion(state, offices);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe('bay');
    expect(result[0].label).toBe('SF Bay Area');
    expect(result[0].companies.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('lists a company with offices in 3 regions in all 3', () => {
    const state = storeOf(
      company('a', 1500), company('b', 1500), company('c', 1500),
      company('d', 1500), company('e', 1500), company('f', 1500),
      company('multi', 1900),
    );
    const offices = [
      office('a', 'bay'), office('b', 'bay'),
      office('c', 'nyc'), office('d', 'nyc'),
      office('e', 'london'), office('f', 'london'),
      office('multi', 'bay'), office('multi', 'nyc'), office('multi', 'london'),
    ];

    const result = companiesByRegion(state, offices);
    const regions = result.filter(r => r.companies.some(c => c.id === 'multi')).map(r => r.region);
    expect(regions.sort()).toEqual(['bay', 'london', 'nyc']);
  });

  it('lists a company with 2 offices in the same region only once', () => {
    const state = storeOf(company('a', 1500), company('b', 1600), company('dup', 1700));
    const offices = [
      office('a', 'nyc'),
      office('b', 'nyc'),
      office('dup', 'nyc'),
      office('dup', 'nyc'), // second office in the same region
    ];

    const result = companiesByRegion(state, offices);
    expect(result).toHaveLength(1);
    const dupCount = result[0].companies.filter(c => c.id === 'dup').length;
    expect(dupCount).toBe(1);
    expect(result[0].companies).toHaveLength(3);
  });

  it('excludes a region with only 2 companies (<3 rule)', () => {
    const state = storeOf(company('a', 1500), company('b', 1600));
    const offices = [office('a', 'seattle'), office('b', 'seattle')];

    expect(companiesByRegion(state, offices)).toEqual([]);
  });

  it('returns empty for an empty offices array', () => {
    const state = storeOf(company('a', 1500), company('b', 1600), company('c', 1700));
    expect(companiesByRegion(state, [])).toEqual([]);
  });

  it('ignores companies with no office in any tracked region', () => {
    const state = storeOf(
      company('a', 1500), company('b', 1600), company('c', 1700),
      company('lonely', 2000),
    );
    const offices = [
      office('a', 'austin'), office('b', 'austin'), office('c', 'austin'),
      office('lonely', null),          // no region
      office('lonely', 'mars'),        // unknown region key
    ];

    const result = companiesByRegion(state, offices);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe('austin');
    expect(result[0].companies.map(c => c.id)).not.toContain('lonely');
  });
});
