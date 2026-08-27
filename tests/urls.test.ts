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
    expect(detectPlatform("https://x.com/founder/status/1234567890")).toBe("x");
    expect(detectPlatform("https://twitter.com/founder/status/1234567890")).toBe("x");
    expect(detectPlatform("https://mobile.twitter.com/founder/status/1234567890")).toBe("x");
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

  it("extracts canonical X status id across URL variants", () => {
    const id = "1234567890123456789";
    expect(extractPlatformVideoId(`https://x.com/founder/status/${id}`, "x")).toBe(id);
    expect(extractPlatformVideoId(`https://twitter.com/founder/status/${id}?s=20`, "x")).toBe(id);
    expect(extractPlatformVideoId(`https://x.com/i/status/${id}`, "x")).toBe(id);
    expect(extractPlatformVideoId(`https://mobile.twitter.com/founder/status/${id}`, "x")).toBe(id);
    expect(extractPlatformVideoId(`https://x.com/founder/status/${id}/video/1?s=46`, "x")).toBe(id);
    expect(extractPlatformVideoId(`https://x.com/founder/status/${id}/photo/1#hash`, "x")).toBe(id);
    expect(normalizeVideoUrl(`https://twitter.com/founder/status/${id}`, "x")).toBe(
      `https://x.com/i/status/${id}`,
    );
    expect(normalizeVideoUrl(`https://x.com/founder/status/${id}`, "x")).toBe(`https://x.com/i/status/${id}`);
    expect(normalizeVideoUrl(`https://x.com/founder/status/${id}/video/1?s=46`, "x")).toBe(
      `https://x.com/i/status/${id}`,
    );
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
    expect(extractProductUrl("visit www.capgo.app/docs for more")).toBe("https://capgo.app");
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

  it("normalizes product URLs to origin only", () => {
    expect(normalizeProductUrl("https://www.myapp.io/")).toBe("https://myapp.io");
    expect(normalizeProductUrl("https://capgo.app/docs/getting-started")).toBe("https://capgo.app");
    expect(normalizeProductUrl("https://www.capgo.app/foo?x=1")).toBe("https://capgo.app");
    expect(normalizeProductUrl("capgo.app")).toBe("https://capgo.app");
    expect(normalizeProductUrl("https://capgo.app/docs/getting-started#section")).toBe("https://capgo.app");
  });

  it("rejects platform hosts as product URLs", () => {
    expect(normalizeProductUrl("https://youtube.com/watch?v=1")).toBeNull();
    expect(normalizeProductUrl("https://www.tiktok.com/@x/video/123")).toBeNull();
    expect(normalizeProductUrl("https://instagram.com/reel/abc")).toBeNull();
    expect(normalizeProductUrl("https://x.com/founder/status/123")).toBeNull();
    expect(normalizeProductUrl("https://twitter.com/founder/status/123")).toBeNull();
    expect(normalizeProductUrl("https://t.co/abc123")).toBeNull();
    expect(normalizeProductUrl("https://pic.x.com/abc123")).toBeNull();
    expect(extractProductUrl("check https://youtube.com/watch?v=1")).toBeNull();
    expect(extractProductUrl("follow https://x.com/founder and visit https://capgo.app")).toBe(
      "https://capgo.app",
    );
  });

  it("rejects vendor chrome hosts as product URLs", () => {
    expect(normalizeProductHost("https://support.google.com/youtube/answer/1")).toBeNull();
    expect(normalizeProductHost("https://accounts.google.com/ServiceLogin")).toBeNull();
    expect(normalizeProductHost("https://play.google.com/store/apps")).toBeNull();
    expect(normalizeProductHost("https://apps.apple.com/app/id123")).toBeNull();
    expect(normalizeProductHost("https://google.com")).toBeNull();

    expect(normalizeProductUrl("https://support.google.com/youtube/answer/3037019")).toBeNull();
    expect(normalizeProductUrl("https://accounts.google.com/ServiceLogin?continue=1")).toBeNull();
    expect(normalizeProductUrl("https://play.google.com/store/apps/details?id=foo")).toBeNull();
    expect(normalizeProductUrl("https://apps.apple.com/app/example/id123")).toBeNull();
    expect(normalizeProductUrl("https://google.com")).toBeNull();
  });

  it("extracts no product from chrome-only YouTube description", () => {
    const desc = [
      "How to Create One Link for Your iOS & Android App | OneLink Tutorial",
      "https://support.google.com/youtube/answer/3037019?hl=en",
      "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/signin",
    ].join("\n");
    expect(extractProductUrl(desc)).toBeNull();
  });

  it("prefers real product URL over vendor chrome in description", () => {
    const desc =
      "promo https://support.google.com/youtube/answer/1 then try https://apppa.ge";
    expect(extractProductUrl(desc)).toBe("https://apppa.ge");
  });

  it("stores first non-platform URL as domain-only", () => {
    const desc =
      "Built with AI? No. Check https://capgo.app/docs/getting-started and also https://youtube.com/watch?v=1";
    expect(extractProductUrl(desc)).toBe("https://capgo.app");
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
    expect(navUrls.some((u) => u.includes("youtube.com"))).toBe(false);
  });

  it("does not append YouTube or Google chrome navigation URLs to description", () => {
    const html = `
      "shortDescription":"Tutorial for Apppa — one link for iOS and Android"
      "urlEndpoint":{"url":"https://support.google.com/youtube/answer/3037019"}
      "urlEndpoint":{"url":"/watch?v=otherVideo"}
      "urlEndpoint":{"url":"https://accounts.google.com/ServiceLogin?service=youtube"}
      "urlEndpoint":{"url":"https://apppa.ge"}
      "webCommandMetadata":{"url":"/premium"}
    `;
    const description = parseDescriptionFromHtml(html, "youtube");
    expect(description).toContain("Tutorial for Apppa");
    expect(description).toContain("https://apppa.ge");
    expect(description).not.toContain("support.google.com");
    expect(description).not.toContain("accounts.google.com");
    expect(description).not.toContain("/watch?v=");
    expect(description).not.toContain("/premium");

    const navUrls = extractYouTubeNavigationUrls(html);
    expect(navUrls).toEqual(["https://apppa.ge"]);
    expect(extractProductUrl(description)).toBe("https://apppa.ge");
  });

  it("keeps navigation URLs with uppercase HTTP(S) schemes", () => {
    const html = `"urlEndpoint":{"url":"HTTPS://capgo.app/docs"}`;
    const navUrls = extractYouTubeNavigationUrls(html);
    expect(navUrls).toEqual(["HTTPS://capgo.app/docs"]);
  });
});
