import { describe, expect, it } from "vitest";
import { founderNameMatchesVideo, isValidFounderName } from "../worker/lib/founder";

describe("founder name checks", () => {
  it("matches full name in title", () => {
    expect(
      founderNameMatchesVideo("Jane Doe", "Jane Doe on building Capgo", "Capgo", "https://capgo.app"),
    ).toBe(true);
  });

  it("matches all name parts across metadata", () => {
    expect(
      founderNameMatchesVideo("Jane Doe", "Weekly update", "Jane Doe", "https://capgo.app"),
    ).toBe(true);
  });

  it("fails when name parts missing", () => {
    expect(
      founderNameMatchesVideo("Jane Doe", "Product walkthrough", "Capgo Official", "https://capgo.app"),
    ).toBe(false);
  });

  it("validates founder name length", () => {
    expect(isValidFounderName("A")).toBe(false);
    expect(isValidFounderName("Jane")).toBe(true);
    expect(isValidFounderName("x".repeat(81))).toBe(false);
  });
});
