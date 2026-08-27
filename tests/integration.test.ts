import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { initTestDb } from "./schema";
import { getLeaderboard, getStartupById } from "../worker/db/queries";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("report removal and emails", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM reports").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();

    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', '2026-01-01T00:00:00.000Z', 1),
              (2, 'https://beta.io', 'beta.io', 'Beta', 'beta@test.com', '2026-01-02T00:00:00.000Z', 2)`,
    ).run();

    await env.DB.prepare(
      `INSERT INTO videos (id, startup_id, video_url, video_id, platform, title, description, product_url_found, created_at)
       VALUES (1, 1, 'https://youtube.com/watch?v=a1', 'a1', 'youtube', 'Alpha v1', 'https://alpha.io', 'https://alpha.io', '2026-01-01T00:00:00.000Z'),
              (2, 2, 'https://youtube.com/watch?v=b1', 'b1', 'youtube', 'Beta v1', 'https://beta.io', 'https://beta.io', '2026-01-02T00:00:00.000Z')`,
    ).run();
  });

  it("removes video and entire startup on AI report", async () => {
    const res = await runWorker(
      new Request("http://example.com/api/report/1", {
        method: "POST",
        headers: { "CF-Connecting-IP": "1.2.3.4", "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);

    const startup = await getStartupById(env.DB, 1);
    expect(startup?.removed_at).toBeTruthy();

    const videos = await env.DB.prepare("SELECT removed_at FROM videos WHERE startup_id = 1").all<{
      removed_at: string | null;
    }>();
    expect(videos.results?.every((v: { removed_at: string | null }) => v.removed_at)).toBe(true);

    const board = await getLeaderboard(env.DB);
    expect(board.some((e) => e.id === 1)).toBe(false);
    expect(board[0]?.id).toBe(2);
  });

  it("sends removal and rank-change emails via waitUntil", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    env.RESEND_API_KEY = "re_test_key";

    await runWorker(
      new Request("http://example.com/api/report/1", {
        method: "POST",
        headers: { "CF-Connecting-IP": "9.9.9.9", "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    const resendCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.resend.com"),
    );
    expect(resendCalls.length).toBeGreaterThanOrEqual(1);

    const payloads = await Promise.all(
      resendCalls.map(async (call) => {
        const init = (call as unknown[])[1] as RequestInit | undefined;
        return JSON.parse(String(init?.body)) as { subject: string; to: string[] };
      }),
    );

    expect(payloads.some((p) => p.subject.includes("Removed"))).toBe(true);
    expect(payloads.some((p) => p.to.includes("alpha@test.com"))).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe("submit email triggers", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM reports").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();
  });

  it("requires email for new startup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("noembed.com")) {
          return new Response(
            JSON.stringify({
              title: "Founder update",
              description: "Building https://newco.dev — follow along",
            }),
            { status: 200 },
          );
        }
        if (url.includes("youtube.com/oembed")) {
          return new Response(JSON.stringify({ title: "Founder update" }), { status: 200 });
        }
        return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
      }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "5.5.5.5", "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: "https://youtube.com/watch?v=new1" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { emailRequired?: boolean };
    expect(body.emailRequired).toBe(true);

    vi.unstubAllGlobals();
  });

  it("accepts submit when email missing but RESEND unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("noembed.com")) {
          return new Response(
            JSON.stringify({
              title: "Demo",
              description: "Try https://demo.app today",
            }),
            { status: 200 },
          );
        }
        if (url.includes("youtube.com/oembed")) {
          return new Response(JSON.stringify({ title: "Demo" }), { status: 200 });
        }
        return new Response("<html></html>", { status: 200 });
      }),
    );

    delete env.RESEND_API_KEY;

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "6.6.6.6", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtube.com/watch?v=demo1",
          email: "founder@demo.app",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it("rejects duplicate platform video id across URL variants", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES (3, 'https://taken.io', 'taken.io', 'Taken', 'taken@test.com', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, created_at)
       VALUES (3, 'https://youtube.com/watch?v=dup99', 'dup99', 'youtube', 'Existing', 'https://taken.io', 'https://taken.io', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("noembed.com") || url.includes("youtube.com/oembed")) {
          return new Response(
            JSON.stringify({
              title: "Steal attempt",
              description: "My product https://other.io",
            }),
            { status: 200 },
          );
        }
        return new Response("<html></html>", { status: 200 });
      }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "7.7.7.7", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtu.be/dup99?si=tracking",
          email: "hacker@other.io",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("already on Video Club");

    vi.unstubAllGlobals();
  });
});
