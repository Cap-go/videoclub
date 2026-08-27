import { describe, expect, it } from "vitest";
import { CHALLENGE_OPTIONS } from "../src/components/ChallengeControl";
import type { ChallengeReason } from "../src/lib/api";

const EXPECTED_REASONS: ChallengeReason[] = ["ai", "not_founder", "not_real_product"];

describe("ChallengeControl challenge reasons", () => {
  it("exposes exactly three challenge reasons", () => {
    expect(CHALLENGE_OPTIONS).toHaveLength(3);
  });

  it("keeps the canonical reason values and labels", () => {
    expect(CHALLENGE_OPTIONS.map((opt) => opt.value)).toEqual(EXPECTED_REASONS);
    expect(CHALLENGE_OPTIONS.map((opt) => opt.label)).toEqual([
      "AI video",
      "Not the founder",
      "Not a real product",
    ]);
  });
});
