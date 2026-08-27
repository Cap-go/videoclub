import { describe, expect, it } from "vitest";
import { buildEmailContent } from "../worker/lib/email-templates";

const APP_URL = "https://videoclub.lol";

describe("buildEmailContent", () => {
  it("renders welcome email with full notification promise", () => {
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
    expect(text).toContain("What we'll email you");
    expect(text).toContain("outranks you");
    expect(text).toContain("challenges one of your videos");
    expect(text).toContain("listing comes off the board");
    expect(html).toContain("#4");
    expect(html).toContain("What we'll email you");
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

  it("renders challenged email at 1/3 with escalation copy", () => {
    const { subject, text } = buildEmailContent(
      {
        kind: "challenged",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        videoUrl: "https://www.youtube.com/watch?v=example",
        videoTitle: "Founder update",
        challengeReason: "AI video",
        challengeCount: 1,
      },
      APP_URL,
    );

    expect(subject).toContain("1/3");
    expect(text).toContain("remove this video and your listing");
    expect(text).toContain("1/3");
  });

  it("renders challenged email at 2/3 with one-more warning", () => {
    const { subject, text } = buildEmailContent(
      {
        kind: "challenged",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        videoUrl: "https://www.youtube.com/watch?v=example",
        videoTitle: "Founder update",
        challengeReason: "Not the founder",
        challengeCount: 2,
      },
      APP_URL,
    );

    expect(subject).toContain("2/3");
    expect(text).toContain("One more distinct challenge");
    expect(text).toContain("2/3");
  });

  it("renders removal email with video, listing, and ban details", () => {
    const { subject, text } = buildEmailContent(
      {
        kind: "removed",
        to: "founder@capgo.app",
        startupName: "Capgo",
        productUrl: "https://capgo.app",
        videoUrl: "https://www.youtube.com/watch?v=example",
        videoTitle: "Founder update",
        removalReason: "Removed after 3 community challenges",
        challengeCount: 3,
      },
      APP_URL,
    );

    expect(subject).toBe("Removed from Video Club");
    expect(text).toContain("What happened");
    expect(text).toContain("video has been removed");
    expect(text).toContain("off the board");
    expect(text).toContain("cannot be re-listed");
  });
});
