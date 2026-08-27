import { describe, expect, it } from "vitest";
import { extractProductUrl } from "../worker/lib/urls";
import {
  oembedHtmlHasVideo,
  parseXOembedHtml,
  parseXSyndicationResponse,
  tweetHasVideo,
  xSyndicationToken,
} from "../worker/lib/video";

describe("X video metadata helpers", () => {
  it("computes syndication token from tweet id", () => {
    expect(xSyndicationToken("1234567890123456789")).toMatch(/^[a-z0-9]+$/);
    expect(xSyndicationToken("1234567890123456789")).toBe(xSyndicationToken("1234567890123456789"));
  });

  it("detects video tweets from syndication payload", () => {
    expect(
      tweetHasVideo({
        text: "hello",
        mediaDetails: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/abc.jpg" }],
      }),
    ).toBe(false);

    expect(
      tweetHasVideo({
        text: "hello",
        mediaDetails: [{ type: "video", media_url_https: "https://pbs.twimg.com/media/abc.jpg" }],
      }),
    ).toBe(true);
  });

  it("parses syndication response and extracts product URL from tweet text", () => {
    const parsed = parseXSyndicationResponse({
      text: "Shipping live updates today — try https://capgo.app",
      created_at: "Wed Aug 27 12:00:00 +0000 2025",
      user: { screen_name: "capgoapp", name: "Capgo" },
      mediaDetails: [{ type: "video", media_url_https: "https://pbs.twimg.com/media/poster.jpg" }],
    });

    expect(parsed.description).toContain("capgo.app");
    expect(extractProductUrl(parsed.description)).toBe("https://capgo.app");
    expect(parsed.platformAccount).toBe("capgoapp");
    expect(parsed.author).toBe("@capgoapp");
  });

  it("detects video in oEmbed HTML", () => {
    const html =
      '<blockquote><p>Check capgo.app</p><video poster="https://video.twimg.com/ext_tw_video/poster.jpg"></video></blockquote>';
    expect(oembedHtmlHasVideo(html)).toBe(true);
    expect(parseXOembedHtml(html).description).toContain("capgo.app");
  });

  it("rejects text-only oEmbed HTML", () => {
    const html = "<blockquote><p>Just text, no media</p></blockquote>";
    expect(oembedHtmlHasVideo(html)).toBe(false);
    expect(parseXOembedHtml(html).hasVideo).toBe(false);
  });
});
