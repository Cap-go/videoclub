const TIER_STEP = 10;

export function boardTierLabel(rank: number): string | null {
  if (rank < TIER_STEP || rank % TIER_STEP !== 0) return null;
  return `Top ${rank}`;
}

export function boardTierAriaLabel(rank: number): string | null {
  if (rank < TIER_STEP || rank % TIER_STEP !== 0) return null;
  return `End of top ${rank}`;
}

export function shouldShowTierDivider(rank: number, entryCount: number): boolean {
  if (rank < TIER_STEP || rank % TIER_STEP !== 0) return false;
  return entryCount > rank;
}

/** Ranks that get a divider when the board is long enough (every 10). */
export function tierRanks(entryCount: number): number[] {
  const ranks: number[] = [];
  for (let rank = TIER_STEP; rank < entryCount; rank += TIER_STEP) {
    ranks.push(rank);
  }
  return ranks;
}
