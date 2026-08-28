import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { resetDataFastCache } from "../worker/lib/datafast-analytics";
import { ONLINE_WINDOW_MS, PRESENCE_COOKIE } from "../worker/lib/presence";
import { initTestDb } from "./schema";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

function cookieFromResponse(response: Response): string | undefined {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return undefined;
  const match = setCookie.match(new RegExp(`${PRESENCE_COOKIE}=([^;]+)`));
  return match?.[1];
}

function clearDataFastEnv() {
  delete env.DATAFAST_API_KEY;
  delete env.DATAFAST_SHARE_URL;
}

describe("visitors API", () => {
  beforeEach(async () => {
    resetDataFastCache();
    clearDataFastEnv();
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM presence").run();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataFastCache();
    clearDataFastEnv();
  });

  it("GET returns liveVisitorCount and visitorsSinceLaunch from D1 when DataFast key is missing", async () => {
    const res = await runWorker(new Request("http://example.com/api/visitors"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 0,
      visitorsSinceLaunch: 0,
      sources: { live: "d1", total: "d1" },
    });
  });

  it("GET uses DataFast all-time visitors when overview succeeds", async () => {
    env.DATAFAST_API_KEY = "df_test_key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/analytics/overview")) {
          expect(url).not.toContain("websiteId=");
          expect(url).toContain("fields=visitors");
          return new Response(
            JSON.stringify({ status: "success", data: [{ visitors: 412 }] }),
            { status: 200 },
          );
        }
        if (url.includes("/api/v1/analytics/realtime")) {
          return new Response(
            JSON.stringify({ status: "success", data: [{ visitors: 7 }] }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    await env.DB.prepare(
      `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?)`,
    )
      .bind("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", new Date().toISOString(), new Date().toISOString())
      .run();

    const res = await runWorker(new Request("http://example.com/api/visitors"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 7,
      visitorsSinceLaunch: 412,
      sources: { live: "datafast", total: "datafast" },
    });
  });

  it("falls back to D1 counts when DataFast key is missing", async () => {
    const recentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const recentLastSeen = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?)`,
    )
      .bind(recentId, recentLastSeen, recentLastSeen)
      .run();

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(new Request("http://example.com/api/visitors"));
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 1,
      visitorsSinceLaunch: 1,
      sources: { live: "d1", total: "d1" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to D1 when DataFast overview fails", async () => {
    env.DATAFAST_API_KEY = "df_test_key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/analytics/overview")) {
          return new Response("upstream error", { status: 502 });
        }
        if (url.includes("/api/v1/analytics/realtime")) {
          return new Response(
            JSON.stringify({ status: "success", data: [{ visitors: 3 }] }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    await env.DB.prepare(
      `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?)`,
    )
      .bind("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", new Date().toISOString(), new Date().toISOString())
      .run();

    const res = await runWorker(new Request("http://example.com/api/visitors"));
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 3,
      visitorsSinceLaunch: 1,
      sources: { live: "datafast", total: "d1" },
    });
  });

  it("includes statsShareUrl when DATAFAST_SHARE_URL is set", async () => {
    env.DATAFAST_API_KEY = "df_test_key";
    env.DATAFAST_SHARE_URL = "https://datafa.st/share/example";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/analytics/overview")) {
          return new Response(
            JSON.stringify({ status: "success", data: [{ visitors: 100 }] }),
            { status: 200 },
          );
        }
        if (url.includes("/api/v1/analytics/realtime")) {
          return new Response(
            JSON.stringify({ status: "success", data: [{ visitors: 2 }] }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const res = await runWorker(new Request("http://example.com/api/visitors"));
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 2,
      visitorsSinceLaunch: 100,
      statsShareUrl: "https://datafa.st/share/example",
      sources: { live: "datafast", total: "datafast" },
    });
  });

  it("POST increments total once per visitor cookie", async () => {
    const first = await runWorker(
      new Request("http://example.com/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody).toEqual({
      liveVisitorCount: 1,
      visitorsSinceLaunch: 1,
      sources: { live: "d1", total: "d1" },
    });

    const visitorId = cookieFromResponse(first);
    expect(visitorId).toBeTruthy();

    const second = await runWorker(
      new Request("http://example.com/api/visitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${PRESENCE_COOKIE}=${visitorId}`,
        },
        body: "{}",
      }),
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody).toEqual({
      liveVisitorCount: 1,
      visitorsSinceLaunch: 1,
      sources: { live: "d1", total: "d1" },
    });
  });

  it("counts only visitors seen within the online window", async () => {
    const recentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const staleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const staleLastSeen = new Date(Date.now() - ONLINE_WINDOW_MS - 60_000).toISOString();
    const recentLastSeen = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?), (?, ?, ?)`,
    )
      .bind(recentId, recentLastSeen, recentLastSeen, staleId, staleLastSeen, staleLastSeen)
      .run();

    const res = await runWorker(new Request("http://example.com/api/visitors"));
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 1,
      visitorsSinceLaunch: 2,
      sources: { live: "d1", total: "d1" },
    });
  });

  it("creates presence table on write when migration has not run", async () => {
    await env.DB.prepare("DROP TABLE IF EXISTS presence").run();

    const res = await runWorker(
      new Request("http://example.com/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      liveVisitorCount: 1,
      visitorsSinceLaunch: 1,
      sources: { live: "d1", total: "d1" },
    });
  });
});
