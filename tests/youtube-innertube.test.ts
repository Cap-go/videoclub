import { describe, expect, it } from "vitest";
import capgoShortFixture from "./fixtures/youtube-innertube-capgo-short.json";
import { parseInnertubePlayerResponse } from "../worker/lib/video";
import { extractProductUrl } from "../worker/lib/urls";

describe("YouTube InnerTube player parsing", () => {
  it("extracts shortDescription with capgo.app links from a real-shaped payload", () => {
    const parsed = parseInnertubePlayerResponse(capgoShortFixture);
    expect(parsed.description).toContain("capgo.app");
    expect(parsed.description).toContain("https://capgo.app/docs/getting-started/onboarding/");
    expect(parsed.publishedAt).toContain("2026");
    expect(parsed.blocked).toBe(false);
  });

  it("finds product URL via extractProductUrl on fixture description", () => {
    const parsed = parseInnertubePlayerResponse(capgoShortFixture);
    expect(extractProductUrl(parsed.description)).toBe(
      "https://capgo.app/docs/getting-started/onboarding",
    );
  });

  it("flags LOGIN_REQUIRED as blocked", () => {
    const parsed = parseInnertubePlayerResponse({
      playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" },
    });
    expect(parsed.blocked).toBe(true);
    expect(parsed.description).toBe("");
  });
});
