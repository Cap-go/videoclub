import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { initTestDb } from "./schema";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

async function seedLogoStartup() {
  await initTestDb(env.DB);
  await env.DB.prepare("DELETE FROM startups").run();
  await env.DB.prepare(
    `INSERT INTO startups (product_url, product_host, name, email, created_at)
     VALUES ('https://newco.dev', 'newco.dev', 'Newco', 'founder@newco.dev', datetime('now'))`,
  ).run();
}

async function clearLogoCache(host = "newco.dev") {
  const cache = await caches.open("videoclub-logos");
  await cache.delete(new Request(`https://logo.videoclub.internal/${host}`));
}

describe("logo proxy", () => {
  beforeEach(async () => {
    await seedLogoStartup();
    await clearLogoCache();
  });

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

  it("rejects blocked and unknown hosts", async () => {
    const blocked = await runWorker(new Request("http://videoclub.lol/api/logo/youtube.com"));
    expect(blocked.status).toBe(400);

    const unknown = await runWorker(new Request("http://videoclub.lol/api/logo/unknown.dev"));
    expect(unknown.status).toBe(400);
  });
});
