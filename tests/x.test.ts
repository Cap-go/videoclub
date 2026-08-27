import { afterEach, describe, expect, it, vi } from "vitest";
import { extractProductUrl } from "../worker/lib/urls";
import {
  extractXMentionsFromFxTwitter,
  extractXMentionsFromSyndication,
  fetchVideoMetadata,
  fxTwitterHasVideo,
  oembedHtmlHasVideo,
  parseFxTwitterResponse,
  parseXOembedHtml,
  parseXSyndicationResponse,
  resolveXProductUrl,
  tweetHasVideo,
  xSyndicationToken,
} from "../worker/lib/video";

const JESSE_TWEET_ID = "2076537635473072483";
const JESSE_VIDEO_URL = `https://x.com/jessethanley/status/${JESSE_TWEET_ID}/video/1?s=46`;

const JESSE_SYNDICATION_FIXTURE = {
  id_str: JESSE_TWEET_ID,
  text: "Trying something new: working on things with @Bento. https://t.co/A8f7HL18ea",
  created_at: "Mon Jul 13 05:22:07 +0000 2026",
  user: { screen_name: "jessethanley", name: "Jesse Hanley" },
  entities: {
    user_mentions: [{ id_str: "2772253272", screen_name: "Bento", name: "Bento" }],
    urls: [{ url: "https://t.co/A8f7HL18ea", expanded_url: "https://pic.x.com/A8f7HL18ea" }],
  },
  mediaDetails: [
    {
      type: "video",
      media_url_https: "https://pbs.twimg.com/amplify_video_thumb/2076535576577310720/img/poster.jpg",
    },
  ],
};

const JESSE_FX_TWEET_FIXTURE = {
  text: "Trying something new: working on things with @Bento.",
  created_at: "Mon Jul 13 05:22:07 +0000 2026",
  author: {
    screen_name: "jessethanley",
    name: "Jesse Hanley",
    website: { url: "https://www.jessehanley.com", display_url: "jessehanley.com" },
  },
  raw_text: {
    text: "Trying something new: working on things with @Bento.",
    facets: [{ type: "mention", original: "Bento", id: "2772253272" }],
  },
  media: {
    all: [{ type: "video", thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/poster.jpg" }],
    videos: [{ type: "video" }],
  },
};

const BENTO_PROFILE_FIXTURE = {
  code: 200,
  user: {
    screen_name: "Bento",
    website: { url: "https://bentonow.com?learn_more=true&utm_campaign=twitter", display_url: "bentonow.com" },
  },
};

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

  it("does not extract product URL from Jesse tweet text with only @Bento and t.co media", () => {
    const parsed = parseXSyndicationResponse(JESSE_SYNDICATION_FIXTURE);
    expect(extractProductUrl(parsed.description)).toBeNull();
    expect(extractXMentionsFromSyndication(JESSE_SYNDICATION_FIXTURE)).toEqual(["Bento"]);
    expect(extractXMentionsFromFxTwitter(JESSE_FX_TWEET_FIXTURE)).toEqual(["Bento"]);
  });

  it("resolves product URL from tagged business mention profile website", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("api.fxtwitter.com/Bento")) {
          return new Response(JSON.stringify(BENTO_PROFILE_FIXTURE), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    const productUrl = await resolveXProductUrl(
      JESSE_SYNDICATION_FIXTURE.text,
      "jessethanley",
      {},
      { syndication: JESSE_SYNDICATION_FIXTURE },
    );
    expect(productUrl).toBe("https://bentonow.com");
  });

  it("prefers explicit product URL in tweet text over mention profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );

    const productUrl = await resolveXProductUrl(
      "Check https://capgo.app and @Bento",
      "jessethanley",
      {},
      { syndication: JESSE_SYNDICATION_FIXTURE },
    );
    expect(productUrl).toBe("https://capgo.app");
  });

  it("does not use author personal website when resolving mentions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("api.fxtwitter.com/jessethanley")) {
          return new Response(
            JSON.stringify({
              code: 200,
              user: { screen_name: "jessethanley", website: { url: "https://www.jessehanley.com" } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );

    const productUrl = await resolveXProductUrl(
      "Working on things with @jessethanley",
      "jessethanley",
      {},
      {
        syndication: {
          text: "Working on things with @jessethanley",
          user: { screen_name: "jessethanley" },
          entities: { user_mentions: [{ screen_name: "jessethanley" }] },
        },
      },
    );
    expect(productUrl).toBeNull();
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
        if (url.includes("api.fxtwitter.com/status/")) {
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
    expect(metadata.productUrl).toBe("https://capgo.app");
    expect(extractProductUrl(metadata.description)).toBe("https://capgo.app");
    expect(metadata.platformAccount).toBe("capgoapp");
  });

  it("resolves Jesse /video/1 URL to Bento via tagged business mention", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("cdn.syndication.twimg.com")) {
          return new Response(JSON.stringify(JESSE_SYNDICATION_FIXTURE), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("api.fxtwitter.com/Bento")) {
          return new Response(JSON.stringify(BENTO_PROFILE_FIXTURE), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    const metadata = await fetchVideoMetadata(JESSE_VIDEO_URL);
    expect(metadata.videoId).toBe(JESSE_TWEET_ID);
    expect(metadata.normalizedUrl).toBe(`https://x.com/i/status/${JESSE_TWEET_ID}`);
    expect(extractProductUrl(metadata.description)).toBeNull();
    expect(metadata.productUrl).toBe("https://bentonow.com");
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
