import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";
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

describe("visitors API", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM presence").run();
  });

  it("GET returns liveVisitorCount and visitorsSinceLaunch", async () => {
    const res = await runWorker(new Request("http://example.com/api/visitors"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ liveVisitorCount: 0, visitorsSinceLaunch: 0 });
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
    expect(firstBody).toEqual({ liveVisitorCount: 1, visitorsSinceLaunch: 1 });

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
    expect(secondBody).toEqual({ liveVisitorCount: 1, visitorsSinceLaunch: 1 });
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
    expect(body).toEqual({ liveVisitorCount: 1, visitorsSinceLaunch: 2 });
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
    expect(body).toEqual({ liveVisitorCount: 1, visitorsSinceLaunch: 1 });
  });
});
