import { describe, expect, it } from "vitest";
import {
  boardTierAriaLabel,
  boardTierLabel,
  shouldShowTierDivider,
  tierRanks,
} from "../src/lib/leaderboard-tiers";

describe("boardTierLabel", () => {
  it("returns Top N every 10 ranks", () => {
    expect(boardTierLabel(10)).toBe("Top 10");
    expect(boardTierLabel(20)).toBe("Top 20");
    expect(boardTierLabel(30)).toBe("Top 30");
    expect(boardTierLabel(50)).toBe("Top 50");
    expect(boardTierLabel(9)).toBeNull();
    expect(boardTierLabel(11)).toBeNull();
    expect(boardTierLabel(15)).toBeNull();
    expect(boardTierLabel(25)).toBeNull();
  });
});

describe("boardTierAriaLabel", () => {
  it("returns end-of-band aria labels for every 10th rank", () => {
    expect(boardTierAriaLabel(10)).toBe("End of top 10");
    expect(boardTierAriaLabel(20)).toBe("End of top 20");
    expect(boardTierAriaLabel(30)).toBe("End of top 30");
    expect(boardTierAriaLabel(9)).toBeNull();
    expect(boardTierAriaLabel(11)).toBeNull();
  });
});

describe("shouldShowTierDivider", () => {
  it("does not show Top 10 when the board has exactly 10 entries", () => {
    expect(shouldShowTierDivider(10, 10)).toBe(false);
  });

  it("shows Top 10 when there is an 11th entry", () => {
    expect(shouldShowTierDivider(10, 11)).toBe(true);
  });

  it("shows Top 20 / Top 30 only when more entries exist below", () => {
    expect(shouldShowTierDivider(20, 20)).toBe(false);
    expect(shouldShowTierDivider(20, 21)).toBe(true);
    expect(shouldShowTierDivider(30, 30)).toBe(false);
    expect(shouldShowTierDivider(30, 31)).toBe(true);
  });

  it("does not show dividers at non-tier ranks", () => {
    expect(shouldShowTierDivider(9, 100)).toBe(false);
    expect(shouldShowTierDivider(15, 100)).toBe(false);
    expect(shouldShowTierDivider(25, 100)).toBe(false);
  });
});

describe("tierRanks", () => {
  it("lists every 10th rank below the board length", () => {
    expect(tierRanks(10)).toEqual([]);
    expect(tierRanks(11)).toEqual([10]);
    expect(tierRanks(20)).toEqual([10]);
    expect(tierRanks(21)).toEqual([10, 20]);
    expect(tierRanks(45)).toEqual([10, 20, 30, 40]);
  });
});
