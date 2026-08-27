const TIER_RANKS = [10, 20] as const;

export type BoardTierLabel = "Top 10" | "Top 20";

export function boardTierLabel(rank: number): BoardTierLabel | null {
  if (rank === 10) return "Top 10";
  if (rank === 20) return "Top 20";
  return null;
}

export function boardTierAriaLabel(rank: number): string | null {
  if (rank === 10) return "End of top 10";
  if (rank === 20) return "End of top 20";
  return null;
}

export function shouldShowTierDivider(rank: number, entryCount: number): boolean {
  const label = boardTierLabel(rank);
  if (!label) return false;
  return entryCount > rank;
}

export function tierRanks(): readonly number[] {
  return TIER_RANKS;
}
