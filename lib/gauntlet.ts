// Pure gauntlet state machine — no React, no side effects. Testable in isolation.

export const STREAK_CAP = 6;

export interface GauntletState {
  championId: string | null;
  streak: number;
}

export type VoteSource = 'gauntlet' | 'random';

export interface GauntletTransition {
  champion: string | null;
  streak: number;
  // The id to exclude from the very next fresh-pair draw (just-retired champion).
  excludeId: string | null;
  source: VoteSource;
}

/**
 * Advance gauntlet state after a vote.
 *
 * @param current  - current champion + streak
 * @param winnerId - the company that won the matchup
 * @param pairIds  - [companyA, companyB] that were in the matchup
 * @returns the new gauntlet transition to apply
 */
export function advanceGauntlet(
  current: GauntletState,
  winnerId: string,
  pairIds: [string, string],
): GauntletTransition {
  const loserId = pairIds[0] === winnerId ? pairIds[1] : pairIds[0];
  void loserId; // available for future use (e.g. logging)

  // `source` describes the matchup that was JUST voted on, for measuring sampling
  // skew later. A champion on screen pre-vote means this pair was gauntlet-selected;
  // no champion means it was a fresh/random draw. This is determined by the
  // PRE-vote state, never the outcome.
  const source: VoteSource = current.championId !== null ? 'gauntlet' : 'random';

  const isChampionWin = current.championId === winnerId;
  const newStreak = isChampionWin ? current.streak + 1 : 1;

  // Champion hits the cap — retire and draw fresh
  if (newStreak >= STREAK_CAP) {
    return {
      champion: null,
      streak: 0,
      excludeId: winnerId, // exclude the just-retired champion from immediate next draw
      source,
    };
  }

  // Normal win: winner becomes champion (could be same or new)
  return {
    champion: winnerId,
    streak: newStreak,
    excludeId: null,
    source,
  };
}

/**
 * Skip: always draw fresh, no champion carried, no exclude.
 */
export function skipGauntlet(): GauntletTransition {
  return { champion: null, streak: 0, excludeId: null, source: 'random' };
}
