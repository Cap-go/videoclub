import { describe, expect, it } from "vitest";
import {
  foreignAccountMessage,
  normalizePlatformAccount,
  resolvePlatformAccount,
} from "../worker/lib/platform-account";

describe("platform account identity", () => {
  it("normalizes account strings", () => {
    expect(normalizePlatformAccount("https://www.youtube.com/@CapgoApp/")).toBe(
      "https://www.youtube.com/@capgoapp",
    );
  });

  it("prefers YouTube author_url over author name", () => {
    expect(
      resolvePlatformAccount("youtube", {
        authorUrl: "https://www.youtube.com/@CapgoApp",
        author: "Other Name",
      }),
    ).toBe("https://www.youtube.com/@capgoapp");
  });

  it("falls back to YouTube author name", () => {
    expect(resolvePlatformAccount("youtube", { author: "Capgo" })).toBe("youtube:capgo");
  });

  it("resolves TikTok handle", () => {
    expect(
      resolvePlatformAccount("tiktok", {
        authorUrl: "https://www.tiktok.com/@capgo",
      }),
    ).toBe("https://www.tiktok.com/@capgo");
  });

  it("builds foreign account message", () => {
    expect(foreignAccountMessage("youtube")).toContain("YouTube");
  });
});
