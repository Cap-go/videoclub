import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";
import { initTestDb } from "./schema";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("GET /api/feed", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM challenges").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();

    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', ?, 1),
              (2, 'https://beta.io', 'beta.io', 'Beta', 'beta@test.com', ?, 2),
              (3, 'https://removed.io', 'removed.io', 'Removed', 'removed@test.com', ?, NULL)`,
    )
      .bind(twoDaysAgo, yesterday, twoDaysAgo)
      .run();

    await env.DB.prepare(
      `UPDATE startups SET removed_at = ?, removal_reason = 'Removed after challenges' WHERE id = 3`,
    )
      .bind(now)
      .run();

    await env.DB.prepare(
      `INSERT INTO videos (id, startup_id, video_url, video_id, platform, title, description, product_url_found, published_at, created_at, removed_at)
       VALUES (1, 1, 'https://youtube.com/watch?v=a1', 'a1', 'youtube', 'Alpha newest', 'https://alpha.io', 'https://alpha.io', ?, ?, NULL),
              (2, 1, 'https://youtube.com/watch?v=a2', 'a2', 'youtube', 'Alpha older', 'https://alpha.io', 'https://alpha.io', ?, ?, NULL),
              (3, 2, 'https://youtube.com/watch?v=b1', 'b1', 'youtube', 'Beta video', 'https://beta.io', 'https://beta.io', ?, ?, NULL),
              (4, 1, 'https://youtube.com/watch?v=removed', 'removed', 'youtube', 'Removed video', 'https://alpha.io', 'https://alpha.io', ?, ?, ?),
              (5, 3, 'https://youtube.com/watch?v=startup-removed', 'startup-removed', 'youtube', 'Startup removed', 'https://removed.io', 'https://removed.io', ?, ?, NULL)`,
    )
      .bind(now, now, yesterday, yesterday, twoDaysAgo, twoDaysAgo, twoDaysAgo, twoDaysAgo, now, twoDaysAgo, twoDaysAgo)
      .run();
  });

  it("returns active videos newest first and excludes removed videos and startups", async () => {
    const res = await runWorker(new Request("http://example.com/api/feed"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      videos: Array<{ id: number; title: string; startup: { name: string; rank: number | null } }>;
      nextCursor: string | null;
    };

    expect(body.videos.map((v) => v.id)).toEqual([1, 2, 3]);
    expect(body.videos[0]?.title).toBe("Alpha newest");
    expect(body.videos[0]?.startup.rank).toBe(1);
    expect(body.videos.some((v) => v.title === "Removed video")).toBe(false);
    expect(body.videos.some((v) => v.startup.name === "Removed")).toBe(false);
  });

  it("paginates with cursor", async () => {
    const first = await runWorker(new Request("http://example.com/api/feed?limit=2"));
    const firstBody = (await first.json()) as {
      videos: Array<{ id: number }>;
      nextCursor: string | null;
    };

    expect(firstBody.videos).toHaveLength(2);
    expect(firstBody.nextCursor).toBe("2");

    const second = await runWorker(
      new Request(`http://example.com/api/feed?limit=2&cursor=${firstBody.nextCursor}`),
    );
    const secondBody = (await second.json()) as {
      videos: Array<{ id: number }>;
      nextCursor: string | null;
    };

    expect(secondBody.videos.map((v) => v.id)).toEqual([3]);
    expect(secondBody.nextCursor).toBeNull();
  });
});
