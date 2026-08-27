import { describe, expect, it } from "vitest";
import { buildEmbedInfo } from "../worker/lib/embed";

describe("embed URL builders", () => {
  it("builds privacy-enhanced YouTube embed URLs", () => {
    const info = buildEmbedInfo("youtube", "dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(info.mode).toBe("iframe");
    expect(info.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(info.watchUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("builds TikTok official embed URLs", () => {
    const info = buildEmbedInfo(
      "tiktok",
      "7123456789012345678",
      "https://www.tiktok.com/@founder/video/7123456789012345678",
    );
    expect(info.mode).toBe("iframe");
    expect(info.embedUrl).toBe("https://www.tiktok.com/embed/v2/7123456789012345678");
    expect(info.watchUrl).toContain("7123456789012345678");
  });

  it("builds Instagram reel embed URLs with fallback mode", () => {
    const info = buildEmbedInfo("instagram", "ABC123xyz", "https://www.instagram.com/reel/ABC123xyz/");
    expect(info.mode).toBe("fallback");
    expect(info.embedUrl).toBe("https://www.instagram.com/reel/ABC123xyz/embed");
    expect(info.watchUrl).toBe("https://www.instagram.com/reel/ABC123xyz/");
  });

  it("builds Instagram post embed URLs for /p/ links", () => {
    const info = buildEmbedInfo("instagram", "XYZ_9-a", "https://www.instagram.com/p/XYZ_9-a/");
    expect(info.mode).toBe("fallback");
    expect(info.embedUrl).toBe("https://www.instagram.com/p/XYZ_9-a/embed");
    expect(info.watchUrl).toBe("https://www.instagram.com/p/XYZ_9-a/");
  });

  it("builds X tweet embed URLs", () => {
    const info = buildEmbedInfo("x", "1234567890123456789", "https://x.com/founder/status/1234567890123456789");
    expect(info.mode).toBe("iframe");
    expect(info.embedUrl).toBe("https://platform.twitter.com/embed/Tweet.html?id=1234567890123456789&dnt=true");
    expect(info.watchUrl).toBe("https://x.com/founder/status/1234567890123456789");
  });

  it("falls back for unknown platforms", () => {
    const info = buildEmbedInfo("vimeo", "123", "https://vimeo.com/123");
    expect(info.mode).toBe("fallback");
    expect(info.embedUrl).toBeNull();
    expect(info.watchUrl).toBe("https://vimeo.com/123");
  });
});
