import { describe, expect, it } from "vitest";
import { computeRanks } from "../worker/db/queries";

describe("computeRanks", () => {
  it("ranks by video count descending", () => {
    const ranked = computeRanks([
      { id: 1, video_count: 2, first_video_at: "2026-01-01T00:00:00.000Z" },
      { id: 2, video_count: 5, first_video_at: "2026-01-02T00:00:00.000Z" },
      { id: 3, video_count: 1, first_video_at: "2026-01-01T00:00:00.000Z" },
    ]);

    expect(ranked.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("tie-breaks by older first video", () => {
    const ranked = computeRanks([
      { id: 1, video_count: 3, first_video_at: "2026-01-03T00:00:00.000Z" },
      { id: 2, video_count: 3, first_video_at: "2026-01-01T00:00:00.000Z" },
      { id: 3, video_count: 3, first_video_at: "2026-01-02T00:00:00.000Z" },
    ]);

    expect(ranked.map((r) => r.id)).toEqual([2, 3, 1]);
  });
});
