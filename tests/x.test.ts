import { afterEach, describe, expect, it, vi } from "vitest";
import { extractProductUrl } from "../worker/lib/urls";
import {
  fetchVideoMetadata,
  fxTwitterHasVideo,
  oembedHtmlHasVideo,
  parseFxTwitterResponse,
  parseXOembedHtml,
  parseXSyndicationResponse,
  tweetHasVideo,
  xSyndicationToken,
} from "../worker/lib/video";

const WESROTH_OEMBED_HTML =
  '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Software Engineering Will Be Automatable in 12 Months</p>&mdash; Wes Roth (@WesRoth) <a href="https://twitter.com/WesRoth/status/2013693268190437410">January 20, 2026</a></blockquote>';

const FX_VIDEO_FIXTURE = {
  text: "Check https://capgo.app for live updates",
  created_at: "Wed Aug 27 12:00:00 +0000 2025",
  author: { screen_name: "capgoapp", name: "Capgo" },
  media: {
    all: [
      {
        type: "video",
        thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/poster.jpg",
      },
    ],
    videos: [{ type: "video" }],
  },
};

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

  it("detects video tweets from fxtwitter payload", () => {
    expect(fxTwitterHasVideo({ text: "hello", media: { all: [{ type: "photo" }] } })).toBe(false);
    expect(fxTwitterHasVideo(FX_VIDEO_FIXTURE)).toBe(true);
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

  it("parses fxtwitter response and extracts product URL from tweet text", () => {
    const parsed = parseFxTwitterResponse(FX_VIDEO_FIXTURE);
    expect(extractProductUrl(parsed.description)).toBe("https://capgo.app");
    expect(parsed.platformAccount).toBe("capgoapp");
  });

  it("does not treat oEmbed HTML without video markers as proof of no video", () => {
    expect(oembedHtmlHasVideo(WESROTH_OEMBED_HTML)).toBe(false);
    expect(parseXOembedHtml(WESROTH_OEMBED_HTML).hasVideo).toBe(false);
    expect(parseXOembedHtml(WESROTH_OEMBED_HTML).description).toContain("Software Engineering");
  });
});

describe("fetchVideoMetadata X fallback ladder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to fxtwitter when syndication is blocked", async () => {
    const tweetId = "2013693268190437410";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("cdn.syndication.twimg.com")) {
          return new Response("<html>blocked</html>", { status: 403 });
        }
        if (url.includes("api.fxtwitter.com")) {
          return new Response(
            JSON.stringify({ code: 200, tweet: FX_VIDEO_FIXTURE }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );

    const metadata = await fetchVideoMetadata(`https://x.com/capgoapp/status/${tweetId}`);
    expect(metadata.platform).toBe("x");
    expect(metadata.videoId).toBe(tweetId);
    expect(extractProductUrl(metadata.description)).toBe("https://capgo.app");
    expect(metadata.platformAccount).toBe("capgoapp");
  });

  it("does not reject a video tweet when oEmbed lacks video markers", async () => {
    const tweetId = "2013693268190437410";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("cdn.syndication.twimg.com")) {
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.includes("api.fxtwitter.com")) {
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.includes("publish.twitter.com/oembed")) {
          return new Response(
            JSON.stringify({
              author_name: "Wes Roth",
              author_url: "https://x.com/WesRoth",
              html: WESROTH_OEMBED_HTML,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );

    await expect(fetchVideoMetadata(`https://x.com/WesRoth/status/${tweetId}`)).rejects.toThrow(
      /couldn't verify this X post/i,
    );
  });

  it("rejects as non-video only when syndication JSON confirms no video media", async () => {
    const tweetId = "1234567890123456789";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("cdn.syndication.twimg.com")) {
          return new Response(
            JSON.stringify({
              id_str: tweetId,
              text: "Just a photo tweet https://capgo.app",
              mediaDetails: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/abc.jpg" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );

    await expect(fetchVideoMetadata(`https://x.com/capgoapp/status/${tweetId}`)).rejects.toThrow(
      /no video/i,
    );
  });
});
