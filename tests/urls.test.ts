import { describe, expect, it } from "vitest";
import { parseDescriptionFromHtml } from "../worker/lib/video";
import {
  detectPlatform,
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

  it("normalizes product hosts", () => {
    expect(normalizeProductHost("https://www.Capgo.app/pricing")).toBe("capgo.app");
    expect(normalizeProductHost("https://youtube.com/watch?v=1")).toBeNull();
    expect(normalizeProductHost("https://tiktok.com/@x")).toBeNull();
  });

  it("extracts first non-platform product URL from description", () => {
    const desc = "Built with AI? No. Check https://capgo.app and also https://youtube.com/watch?v=1";
    expect(extractProductUrl(desc)).toBe("https://capgo.app");
  });

  it("ignores instagram links in description", () => {
    const desc = "Follow https://instagram.com/foo — product: https://myapp.io";
    expect(extractProductUrl(desc)).toBe("https://myapp.io");
  });

  it("normalizes youtube URLs", () => {
    expect(normalizeVideoUrl("https://youtu.be/abc123?si=x", "youtube")).toBe(
      "https://www.youtube.com/watch?v=abc123",
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
});

describe("description parsing", () => {
  it("extracts YouTube shortDescription from HTML", () => {
    const html = `"shortDescription":"Try https://capgo.app today for live updates"`;
    expect(parseDescriptionFromHtml(html, "youtube")).toContain("https://capgo.app");
  });

  it("extracts og:description for instagram-style pages", () => {
    const html = `<meta property="og:description" content="Launch at https://startup.dev now" />`;
    expect(parseDescriptionFromHtml(html, "instagram")).toBe("Launch at https://startup.dev now");
  });
});
