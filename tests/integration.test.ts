import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { initTestDb } from "./schema";
import { getLeaderboard, getStartupById } from "../worker/db/queries";

/** Bytes that pass the skin-tone face heuristic in tests. */
function fakeFaceThumbnailBytes(): Uint8Array {
  const bytes = new Uint8Array(1200);
  for (let i = 0; i < bytes.length; i += 3) {
    bytes[i] = 200;
    bytes[i + 1] = 120;
    bytes[i + 2] = 80;
  }
  return bytes;
}

function mockVideoFetch(extra?: { title?: string; description?: string; author?: string }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("thumbnail.test/face.jpg")) {
      return new Response(fakeFaceThumbnailBytes().buffer as ArrayBuffer, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    if (url.includes("noembed.com")) {
      return new Response(
        JSON.stringify({
          title: extra?.title ?? "Founder update",
          description: extra?.description ?? "Building https://newco.dev — follow along",
          thumbnail_url: "https://thumbnail.test/face.jpg",
          author_name: extra?.author ?? "Jane Founder",
        }),
        { status: 200 },
      );
    }
    if (url.includes("youtube.com/oembed")) {
      return new Response(
        JSON.stringify({
          title: extra?.title ?? "Founder update",
          thumbnail_url: "https://thumbnail.test/face.jpg",
        }),
        { status: 200 },
      );
    }
    return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
  });
}

function mockEmailBinding() {
  env.EMAIL = {
    send: vi.fn(async () => ({ messageId: "test-email-id" })),
  };
}

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
      `INSERT INTO startups (id, product_url, product_host, name, founder_name, name_unconfirmed, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'Alex Alpha', 0, 'alpha@test.com', '2026-01-01T00:00:00.000Z', 1),
              (2, 'https://beta.io', 'beta.io', 'Beta', 'Bob Beta', 0, 'beta@test.com', '2026-01-02T00:00:00.000Z', 2)`,
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
        body: JSON.stringify({ reason: "ai" }),
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
    mockEmailBinding();
    const sendMock = env.EMAIL!.send as ReturnType<typeof vi.fn>;

    await runWorker(
      new Request("http://example.com/api/report/1", {
        method: "POST",
        headers: { "CF-Connecting-IP": "9.9.9.9", "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "not_founder" }),
      }),
    );

    expect(sendMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    const removedCall = sendMock.mock.calls.find(
      (call) => (call[0] as { subject?: string }).subject?.includes("Removed"),
    );
    expect(removedCall).toBeTruthy();
    expect((removedCall![0] as { to?: string }).to).toBe("alpha@test.com");
  });
});

describe("submit email triggers", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM reports").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();
    mockEmailBinding();
  });

  it("requires email and founder name for new startup", async () => {
    vi.stubGlobal("fetch", mockVideoFetch());

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "5.5.5.5", "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: "https://youtube.com/watch?v=new1" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { emailRequired?: boolean; founderNameRequired?: boolean };
    expect(body.emailRequired).toBe(true);

    vi.unstubAllGlobals();
  });

  it("accepts submit when EMAIL binding unavailable", async () => {
    vi.stubGlobal("fetch", mockVideoFetch({ title: "Jane Founder on Capgo", author: "Jane Founder" }));
    (env as { EMAIL?: typeof env.EMAIL }).EMAIL = undefined;

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "6.6.6.6", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtube.com/watch?v=demo1",
          email: "founder@demo.app",
          founderName: "Jane Founder",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; startup: { name_unconfirmed: boolean } };
    expect(body.ok).toBe(true);
    expect(body.startup.name_unconfirmed).toBe(false);

    vi.unstubAllGlobals();
  });

  it("marks name_unconfirmed when founder name not in video metadata", async () => {
    vi.stubGlobal(
      "fetch",
      mockVideoFetch({ title: "Product demo", description: "Try https://mystery.app today", author: "Brand Channel" }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "6.6.6.7", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtube.com/watch?v=mystery1",
          email: "founder@mystery.app",
          founderName: "Sam Unknown",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { startup: { name_unconfirmed: boolean } };
    expect(body.startup.name_unconfirmed).toBe(true);

    vi.unstubAllGlobals();
  });

  it("rejects submit without detectable face", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("noembed.com") || url.includes("youtube.com/oembed")) {
          return new Response(
            JSON.stringify({
              title: "Screen recording",
              description: "https://demo.app",
              thumbnail_url: "https://thumbnail.test/noface.jpg",
            }),
            { status: 200 },
          );
        }
        if (url.includes("thumbnail.test/noface.jpg")) {
          return new Response(new Uint8Array(100), { status: 200 });
        }
        return new Response("<html></html>", { status: 200 });
      }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "6.6.6.8", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtube.com/watch?v=noface1",
          email: "founder@demo.app",
          founderName: "Jane Founder",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("founder on camera");

    vi.unstubAllGlobals();
  });

  it("rejects duplicate platform video id across URL variants", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, founder_name, email, created_at)
       VALUES (3, 'https://taken.io', 'taken.io', 'Taken', 'Taken Founder', 'taken@test.com', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, created_at)
       VALUES (3, 'https://youtube.com/watch?v=dup99', 'dup99', 'youtube', 'Existing', 'https://taken.io', 'https://taken.io', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({ title: "Steal attempt", description: "My product https://other.io" }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "7.7.7.7", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtu.be/dup99?si=tracking",
          email: "hacker@other.io",
          founderName: "Hacker",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("already on Video Club");

    vi.unstubAllGlobals();
  });
});

describe("email previews", () => {
  it("returns all three template previews", async () => {
    const res = await runWorker(new Request("http://example.com/api/dev/email-previews"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { previews: Array<{ kind: string; html: string }> };
    expect(body.previews).toHaveLength(3);
    expect(body.previews.map((p) => p.kind)).toEqual(["welcome", "rank_changed", "removed"]);
    expect(body.previews.every((p) => p.html.includes("videoclub.lol"))).toBe(true);
  });
});
