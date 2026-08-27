import { describe, expect, it } from "vitest";
import {
  collectIconCandidates,
  duckDuckGoIconUrl,
  googleFaviconUrl,
  iconCandidateScore,
  pickBestIconFromHtml,
  sortIconCandidates,
} from "../worker/lib/logo";
import { normalizeProductHost } from "../worker/lib/urls";

describe("logo picker", () => {
  it("prefers 180 apple-touch over 16px favicon", () => {
    const html = `
      <head>
        <link rel="icon" href="/favicon.ico" sizes="16x16" type="image/x-icon">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
      </head>
    `;

    const best = pickBestIconFromHtml(html, "https://newco.dev");
    expect(best?.url).toBe("https://newco.dev/apple-touch-icon.png");
    expect(best?.sizes).toBe(180);
  });

  it("ranks larger apple-touch sizes ahead of tiny icons", () => {
    const candidates = collectIconCandidates(
      `<link rel="icon" href="/favicon.ico" sizes="16x16">
       <link rel="apple-touch-icon" href="/icon-192.png" sizes="192x192">`,
      "https://example.com",
    );

    const sorted = sortIconCandidates(candidates);
    expect(sorted[0]?.url).toBe("https://example.com/icon-192.png");
    expect(iconCandidateScore("icon", 16)).toBeLessThan(0);
    expect(iconCandidateScore("apple-touch-icon", 192)).toBeGreaterThan(0);
  });

  it("builds google fallback URL", () => {
    expect(googleFaviconUrl("newco.dev")).toBe(
      "https://www.google.com/s2/favicons?domain=newco.dev&sz=256",
    );
    expect(duckDuckGoIconUrl("newco.dev")).toBe("https://icons.duckduckgo.com/ip3/newco.dev.ico");
  });

  it("rejects invalid product hosts", () => {
    expect(normalizeProductHost("youtube.com")).toBeNull();
    expect(normalizeProductHost("not a host")).toBeNull();
    expect(normalizeProductHost("newco.dev")).toBe("newco.dev");
  });
});
