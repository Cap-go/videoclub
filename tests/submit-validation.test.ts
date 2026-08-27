import { describe, expect, it } from "vitest";
import {
  BIG_TECH_REJECT_MESSAGE,
  getBigTechRejection,
  isBlockedFounderEmail,
  isBlockedPlatformAccount,
} from "../worker/lib/submit-validation";

describe("submit validation — Big Tech blocks", () => {
  it("rejects official Google YouTube accounts case-insensitively", () => {
    for (const handle of [
      "https://www.youtube.com/@googledevelopers",
      "https://www.youtube.com/@GoogleDevelopers",
      "https://www.youtube.com/@google",
      "https://www.youtube.com/@Google",
      "https://www.youtube.com/@madebygoogle",
      "https://www.youtube.com/@googlecloud",
      "https://www.youtube.com/@androiddevelopers",
      "https://www.youtube.com/@chrome",
      "https://www.youtube.com/@GoogleChrome",
    ]) {
      expect(isBlockedPlatformAccount("youtube", handle)).toBe(true);
    }
    expect(isBlockedPlatformAccount("youtube", "https://www.youtube.com/@capgoapp")).toBe(false);
    expect(isBlockedPlatformAccount("x", "googledevelopers")).toBe(false);
  });

  it("rejects @google.com founder emails but not @gmail.com", () => {
    expect(isBlockedFounderEmail("sundar@google.com")).toBe(true);
    expect(isBlockedFounderEmail("Sundar@Google.COM")).toBe(true);
    expect(isBlockedFounderEmail("founder@gmail.com")).toBe(false);
  });

  it("returns the maker-facing rejection message", () => {
    expect(
      getBigTechRejection({
        productUrl: "https://goo.gle",
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@capgoapp",
      }),
    ).toBe(BIG_TECH_REJECT_MESSAGE);

    expect(
      getBigTechRejection({
        productUrl: null,
        description: "Try https://goo.gle for more",
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@capgoapp",
      }),
    ).toBe(BIG_TECH_REJECT_MESSAGE);

    expect(
      getBigTechRejection({
        productUrl: "https://capgo.app",
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@googledevelopers",
      }),
    ).toBe(BIG_TECH_REJECT_MESSAGE);

    expect(
      getBigTechRejection({
        productUrl: "https://capgo.app",
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@capgoapp",
        email: "sundar@google.com",
      }),
    ).toBe(BIG_TECH_REJECT_MESSAGE);

    expect(
      getBigTechRejection({
        productUrl: "https://capgo.app",
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@capgoapp",
        email: "founder@gmail.com",
      }),
    ).toBeNull();
  });

  it("does not reject when a real product is resolved alongside Google chrome URLs", () => {
    const description =
      "Get it on https://play.google.com/store/apps/details?id=app and visit https://capgo.app";

    expect(
      getBigTechRejection({
        productUrl: "https://capgo.app",
        description,
        platform: "youtube",
        platformAccount: "https://www.youtube.com/@capgoapp",
        email: "founder@gmail.com",
      }),
    ).toBeNull();
  });
});
