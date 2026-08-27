import { describe, expect, it } from "vitest";
import {
  extractYouTubeNavigationUrls,
  parseDescriptionFromHtml,
  parsePublishedAtFromHtml,
} from "../worker/lib/video";
import {
  DUPLICATE_VIDEO_MESSAGE,
  detectPlatform,
  extractPlatformVideoId,
  extractProductUrl,
  hostToName,
  isValidEmail,
  normalizeProductHost,
  normalizeProductUrl,
  normalizeVideoUrl,
} from "../worker/lib/urls";

describe("URL parsing", () => {
  it("detects supported platforms", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://www.tiktok.com/@x/video/123")).toBe("tiktok");
    expect(detectPlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(detectPlatform("https://example.com")).toBeNull();
  });

  it("extracts canonical YouTube id across URL variants", () => {
    const id = "dQw4w9WgXcQ";
    expect(extractPlatformVideoId(`https://www.youtube.com/watch?v=${id}&si=foo`, "youtube")).toBe(id);
    expect(extractPlatformVideoId(`https://youtu.be/${id}?si=bar`, "youtube")).toBe(id);
    expect(extractPlatformVideoId(`https://www.youtube.com/shorts/${id}`, "youtube")).toBe(id);
    expect(normalizeVideoUrl(`https://youtu.be/${id}?si=x`, "youtube")).toBe(
      `https://www.youtube.com/watch?v=${id}`,
    );
    expect(normalizeVideoUrl(`https://www.youtube.com/shorts/${id}`, "youtube")).toBe(
      `https://www.youtube.com/watch?v=${id}`,
    );
  });

  it("extracts TikTok and Instagram ids", () => {
    expect(extractPlatformVideoId("https://www.tiktok.com/@founder/video/7123456789012345678", "tiktok")).toBe(
      "7123456789012345678",
    );
    expect(extractPlatformVideoId("https://www.instagram.com/reel/ABC123xyz/", "instagram")).toBe("ABC123xyz");
    expect(extractPlatformVideoId("https://www.instagram.com/p/XYZ_9-a/", "instagram")).toBe("XYZ_9-a");
  });

  it("treats same content on different platforms as different ids", () => {
    const youtube = extractPlatformVideoId("https://www.youtube.com/watch?v=abc12345678", "youtube");
    const tiktok = extractPlatformVideoId("https://www.tiktok.com/@x/video/7123456789012345678", "tiktok");
    const instagram = extractPlatformVideoId("https://www.instagram.com/reel/DiffShort1/", "instagram");
    expect(youtube).toBe("abc12345678");
    expect(tiktok).toBe("7123456789012345678");
    expect(instagram).toBe("DiffShort1");
  });

  it("normalizes product hosts", () => {
    expect(normalizeProductHost("https://www.Capgo.app/pricing")).toBe("capgo.app");
    expect(normalizeProductHost("https://youtube.com/watch?v=1")).toBeNull();
  });

  it("extracts first non-platform product URL from description", () => {
    const desc = "Built with AI? No. Check https://capgo.app and also https://youtube.com/watch?v=1";
    expect(extractProductUrl(desc)).toBe("https://capgo.app");
  });

  it("extracts bare domain without scheme as https", () => {
    expect(extractProductUrl("try capgo.app today")).toBe("https://capgo.app");
    expect(extractProductUrl("visit www.capgo.app/docs for more")).toBe("https://capgo.app/docs");
  });

  it("prefers explicit https URL over bare domain", () => {
    const desc = "capgo.app is cool but use https://myapp.io instead";
    expect(extractProductUrl(desc)).toBe("https://myapp.io");
  });

  it("parses YouTube id starting with hyphen from shorts and watch URLs", () => {
    const id = "-abGcOfoKHg";
    expect(extractPlatformVideoId(`https://youtube.com/shorts/${id}`, "youtube")).toBe(id);
    expect(extractPlatformVideoId(`https://www.youtube.com/watch?v=${id}`, "youtube")).toBe(id);
    expect(normalizeVideoUrl(`https://youtube.com/shorts/${id}`, "youtube")).toBe(
      `https://www.youtube.com/watch?v=${id}`,
    );
  });

  it("normalizes product URLs", () => {
    expect(normalizeProductUrl("https://www.myapp.io/")).toBe("https://myapp.io");
  });

  it("derives startup name from host", () => {
    expect(hostToName("capgo.app")).toBe("Capgo");
  });

  it("validates email", () => {
    expect(isValidEmail("founder@startup.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("exposes duplicate video message", () => {
    expect(DUPLICATE_VIDEO_MESSAGE).toContain("already on Video Club");
  });
});

describe("description parsing", () => {
  it("extracts YouTube shortDescription from HTML", () => {
    const html = `"shortDescription":"Try https://capgo.app today for live updates"`;
    expect(parseDescriptionFromHtml(html, "youtube")).toContain("https://capgo.app");
  });

  it("extracts YouTube uploadDate from HTML", () => {
    const html = `"uploadDate":"2019-06-12"`;
    expect(parsePublishedAtFromHtml(html, "youtube")).toContain("2019");
  });

  it("extracts og:description for instagram-style pages", () => {
    const html = `<meta property="og:description" content="Launch at https://startup.dev now" />`;
    expect(parseDescriptionFromHtml(html, "instagram")).toBe("Launch at https://startup.dev now");
  });

  it("extracts attributedDescription and navigation URLs from Shorts HTML", () => {
    const html = `
      "attributedDescriptionBodyText":"Check out capgo.app for live updates"
      "urlEndpoint":{"url":"https://capgo.app/docs"}
      "webCommandMetadata":{"url":"https://www.youtube.com/redirect?q=https%3A%2F%2Fcapgo.app"}
    `;
    const description = parseDescriptionFromHtml(html, "youtube");
    expect(description).toContain("capgo.app");
    const navUrls = extractYouTubeNavigationUrls(html);
    expect(navUrls.some((u) => u.includes("capgo.app"))).toBe(true);
  });
});
