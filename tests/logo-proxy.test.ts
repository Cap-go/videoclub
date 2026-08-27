import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("logo proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns proxied logo with week cache", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "https://newco.dev/") {
        return new Response(
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }

      if (url === "https://newco.dev/apple-touch-icon.png") {
        return new Response("PNG_BYTES", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }

      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(new Request("http://videoclub.lol/api/logo/newco.dev"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age=604800");
    expect(await res.text()).toBe("PNG_BYTES");
  });

  it("falls back to google when site icons fail", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("https://newco.dev")) {
        return new Response("blocked", { status: 403 });
      }

      if (url.includes("google.com/s2/favicons")) {
        return new Response("GOOGLE_PNG", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }

      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(new Request("http://videoclub.lol/api/logo/newco.dev"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("GOOGLE_PNG");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("google.com/s2/favicons"))).toBe(
      true,
    );
  });

  it("rejects invalid hosts", async () => {
    const res = await runWorker(new Request("http://videoclub.lol/api/logo/youtube.com"));
    expect(res.status).toBe(400);
  });
});
