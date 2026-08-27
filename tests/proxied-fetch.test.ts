import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as browserFetchModule from "../worker/lib/browser-fetch";
import {
  isHtmlBlocked,
  isHttpBlocked,
  isInnertubeBlockedPayload,
  proxiedFetch,
  redactSecretsInText,
  redactUrlForLogs,
} from "../worker/lib/proxied-fetch";
import { fetchVideoMetadata } from "../worker/lib/video";

describe("proxied-fetch helpers", () => {
  it("detects HTTP blocks", () => {
    expect(isHttpBlocked(429)).toBe(true);
    expect(isHttpBlocked(403)).toBe(true);
    expect(isHttpBlocked(200)).toBe(false);
  });

  it("detects innertube LOGIN_REQUIRED", () => {
    expect(
      isInnertubeBlockedPayload({
        playabilityStatus: { status: "LOGIN_REQUIRED" },
      }),
    ).toBe(true);
    expect(
      isInnertubeBlockedPayload({
        playabilityStatus: { status: "OK" },
        videoDetails: { shortDescription: "hello" },
      }),
    ).toBe(false);
  });

  it("detects consent walls in HTML", () => {
    expect(isHtmlBlocked("<html>Before you continue to YouTube</html>")).toBe(true);
    expect(isHtmlBlocked("<html>normal page</html>")).toBe(false);
  });

  it("redacts proxy credentials from logs", () => {
    const url = "https://user:secret-pass@proxy.example/fetch?url=";
    expect(redactUrlForLogs(url)).not.toContain("secret-pass");
    expect(redactUrlForLogs(url)).toContain("[REDACTED]");

    const logLine = `fetch failed for ${url}https://youtube.com/watch?v=abc`;
    const redacted = redactSecretsInText(logLine, ["secret-pass", "https://user:secret-pass@proxy.example"]);
    expect(redacted).not.toContain("secret-pass");
    expect(redacted).toContain("[REDACTED]");
  });
});

describe("proxiedFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries through PROXY_URL relay after a blocked innertube response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ playabilityStatus: { status: "LOGIN_REQUIRED" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            videoDetails: { shortDescription: "Product at https://newco.dev" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await proxiedFetch(
      "https://www.youtube.com/youtubei/v1/player",
      { PROXY_URL: "https://relay.example/fetch?url=" },
      {
        init: {
          method: "POST",
          body: JSON.stringify({ videoId: "abc123" }),
          headers: { "Content-Type": "application/json" },
        },
      },
    );

    expect(outcome.layer).toBe("proxy");
    expect(outcome.blocked).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("relay.example/fetch?url=");
    expect(fetchMock.mock.calls[1]?.[0]).toContain(encodeURIComponent("youtubei/v1/player"));
  });

  it("uses browser rendering when direct is blocked and PROXY_URL is unset", async () => {
    const browserSpy = vi.spyOn(browserFetchModule, "browserFetch").mockResolvedValue({
      status: 200,
      body: "<html>ok</html>",
      contentType: "text/html",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("blocked", { status: 429 })),
    );

    const outcome = await proxiedFetch(
      "https://www.tiktok.com/@x/video/123",
      { BROWSER: {} as unknown as BrowserRun },
      { init: { headers: { Accept: "text/html" } } },
    );

    expect(outcome.layer).toBe("browser");
    expect(browserSpy).toHaveBeenCalledOnce();
  });
});

describe("fetchVideoMetadata proxy fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to proxy after blocked innertube and never logs proxy credentials", async () => {
    const secret = "super-secret-proxy-key";
    const proxyBase = `https://user:${secret}@relay.example/fetch?url=`;
    const logs: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("youtube.com/oembed")) {
        return new Response(JSON.stringify({ title: "Founder update", author_name: "Founder" }), {
          status: 200,
        });
      }
      if (url.includes("youtubei/v1/player") && !url.includes("relay.example")) {
        return new Response(JSON.stringify({ playabilityStatus: { status: "LOGIN_REQUIRED" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("relay.example")) {
        return new Response(
          JSON.stringify({
            videoDetails: { shortDescription: "Building https://newco.dev — follow along" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await fetchVideoMetadata("https://youtube.com/watch?v=blocked1", {
      PROXY_URL: proxyBase,
    });

    expect(metadata.description).toContain("https://newco.dev");
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("relay.example"))).toBe(true);
    for (const line of logs) {
      expect(line).not.toContain(secret);
    }

    console.warn = originalWarn;
  });
});
