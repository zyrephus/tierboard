// node --test lib/company.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winProbability, sectorStandings, closestPeers } from './company.ts';
import type { CompanyState } from './types.ts';

const co = (id: string, elo: number, sectors: string[], games = 50): CompanyState => ({
  id, name: id, tagline: '', sectors, elo, startingElo: 1500, votes: games, wins: 0, losses: 0,
  logoUrl: null, websiteUrl: null, games, delta24h: 0, rankPrev: null, rank: null,
});

const world = Object.fromEntries([
  co('jane', 1800, ['quant']),
  co('citadel', 1740, ['quant']),
  co('drw', 1600, ['quant']),
  co('newco', 1500, ['quant'], 0), // unranked: no games yet
  co('openai', 1900, ['ai']),
].map(c => [c.id, c]));

test('equal index is a coin flip', () => {
  assert.equal(winProbability(1500, 1500), 0.5);
});

test('one scale step is 10:1, not the chess 400 curve', () => {
  // +120 index = 10x strength = 10/11 win probability.
  assert.ok(Math.abs(winProbability(1620, 1500) - 10 / 11) < 1e-9);
});

test('win probability is symmetric', () => {
  assert.ok(Math.abs(winProbability(1800, 1740) + winProbability(1740, 1800) - 1) < 1e-12);
});

test('sector standing counts only ranked peers', () => {
  const [quant] = sectorStandings(world.citadel, world);
  assert.deepEqual(quant, { sectorId: 'quant', rank: 2, total: 3 }); // newco excluded
});

test('peers exclude self and the unranked', () => {
  const ids = closestPeers(world.jane, world, 3).map(c => c.id);
  assert.ok(!ids.includes('jane'));
  assert.ok(!ids.includes('newco'));
  assert.equal(ids[0], 'citadel'); // nearest by index
});
