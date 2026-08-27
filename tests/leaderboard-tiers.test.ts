import { describe, expect, it } from "vitest";
import {
  boardTierAriaLabel,
  boardTierLabel,
  shouldShowTierDivider,
  tierRanks,
} from "../src/lib/leaderboard-tiers";

describe("boardTierLabel", () => {
  it("returns Top 10 / Top 20 only at those ranks", () => {
    expect(boardTierLabel(10)).toBe("Top 10");
    expect(boardTierLabel(20)).toBe("Top 20");
    expect(boardTierLabel(9)).toBeNull();
    expect(boardTierLabel(11)).toBeNull();
    expect(boardTierLabel(15)).toBeNull();
    expect(boardTierLabel(25)).toBeNull();
    expect(boardTierLabel(50)).toBeNull();
  });
});

describe("boardTierAriaLabel", () => {
  it("returns end-of-band aria labels for tier ranks only", () => {
    expect(boardTierAriaLabel(10)).toBe("End of top 10");
    expect(boardTierAriaLabel(20)).toBe("End of top 20");
    expect(boardTierAriaLabel(9)).toBeNull();
    expect(boardTierAriaLabel(50)).toBeNull();
  });
});

describe("shouldShowTierDivider", () => {
  it("does not show Top 10 when the board has exactly 10 entries", () => {
    expect(shouldShowTierDivider(10, 10)).toBe(false);
  });

  it("shows Top 10 when there is an 11th entry", () => {
    expect(shouldShowTierDivider(10, 11)).toBe(true);
  });

  it("shows Top 20 only when more than 20 entries exist", () => {
    expect(shouldShowTierDivider(20, 20)).toBe(false);
    expect(shouldShowTierDivider(20, 21)).toBe(true);
  });

  it("does not show dividers at non-tier ranks", () => {
    expect(shouldShowTierDivider(9, 100)).toBe(false);
    expect(shouldShowTierDivider(15, 100)).toBe(false);
    expect(shouldShowTierDivider(50, 100)).toBe(false);
  });
});

describe("tierRanks", () => {
  it("exposes only 10 and 20", () => {
    expect(tierRanks()).toEqual([10, 20]);
  });
});
