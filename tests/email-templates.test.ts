import { describe, expect, it } from "vitest";
import { buildEmailContent } from "../worker/lib/email-templates";

const APP_URL = "https://videoclub.lol";

describe("buildEmailContent", () => {
  it("renders welcome email with thanks and outrank promise", () => {
    const { subject, text, html } = buildEmailContent(
      {
        kind: "welcome",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        rank: 4,
      },
      APP_URL,
    );

    expect(subject).toBe("Thanks for joining Video Club");
    expect(text).toContain("Thanks for registering and posting your first video");
    expect(text).toContain("rank #4");
    expect(text).toContain("when another maker outranks you");
    expect(text).toContain("Keep posting real founder videos");
    expect(html).toContain("#4");
    expect(html).toContain("another maker outranks you");
  });

  it("renders outranked email when rank drops", () => {
    const { subject, text } = buildEmailContent(
      {
        kind: "rank_changed",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        rank: 5,
        previousRank: 2,
      },
      APP_URL,
    );

    expect(subject).toBe("Another maker outranked you on Video Club: #2 → #5");
    expect(text).toContain("Another maker outranked Capgo");
    expect(text).toContain("dropped from #2 to #5");
    expect(text).toContain("Keep posting real founder videos");
  });

  it("renders climbed email when rank improves", () => {
    const { subject, text } = buildEmailContent(
      {
        kind: "rank_changed",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        rank: 2,
        previousRank: 5,
      },
      APP_URL,
    );

    expect(subject).toBe("You climbed on Video Club: #5 → #2");
    expect(text).toContain("climbed on Video Club");
    expect(text).toContain("moved from #5 to #2");
  });
});
