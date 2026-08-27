import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";
import { getLeaderboard, getSiteStats } from "../worker/db/queries";
import { initTestDb } from "./schema";
import { rankCardShowsAboutLink } from "../src/lib/stats";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("click and play stats", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM challenges").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();

    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, click_count, play_count)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', '2026-01-01T00:00:00.000Z', 2, 5),
              (2, 'https://beta.io', 'beta.io', 'Beta', 'beta@test.com', '2026-01-02T00:00:00.000Z', 0, 0)`,
    ).run();

    await env.DB.prepare(
      `INSERT INTO videos (id, startup_id, video_url, video_id, platform, title, description, product_url_found, created_at, play_count)
       VALUES (1, 1, 'https://youtube.com/watch?v=a1', 'a1', 'youtube', 'Alpha v1', 'https://alpha.io', 'https://alpha.io', '2026-01-01T00:00:00.000Z', 3),
              (2, 1, 'https://youtube.com/watch?v=a2', 'a2', 'youtube', 'Alpha v2', 'https://alpha.io', 'https://alpha.io', '2026-01-02T00:00:00.000Z', 2),
              (3, 2, 'https://youtube.com/watch?v=b1', 'b1', 'youtube', 'Beta v1', 'https://beta.io', 'https://beta.io', '2026-01-03T00:00:00.000Z', 0)`,
    ).run();
  });

  it("increments startup click_count and site total", async () => {
    const res = await runWorker(new Request("http://example.com/api/startups/1/click", { method: "POST" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { click_count: number; total_clicks: number };
    expect(body.click_count).toBe(3);
    expect(body.total_clicks).toBe(3);

    const stats = await getSiteStats(env.DB);
    expect(stats.total_clicks).toBe(3);
  });

  it("increments video play_count, startup play_count, and site total", async () => {
    const res = await runWorker(new Request("http://example.com/api/videos/1/play", { method: "POST" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      play_count: number;
      startup_play_count: number;
      total_plays: number;
    };
    expect(body.play_count).toBe(4);
    expect(body.startup_play_count).toBe(6);
    expect(body.total_plays).toBe(6);
  });

  it("returns 404 for removed startup click", async () => {
    await env.DB.prepare("UPDATE startups SET removed_at = ? WHERE id = 1").bind(new Date().toISOString()).run();
    const res = await runWorker(new Request("http://example.com/api/startups/1/click", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for removed video play", async () => {
    await env.DB.prepare("UPDATE videos SET removed_at = ? WHERE id = 1").bind(new Date().toISOString()).run();
    const res = await runWorker(new Request("http://example.com/api/videos/1/play", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("includes click and play counts on leaderboard and site totals", async () => {
    const res = await runWorker(new Request("http://example.com/api/leaderboard"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      entries: Array<{ id: number; click_count: number; play_count: number }>;
      total_clicks: number;
      total_plays: number;
    };

    expect(body.total_clicks).toBe(2);
    expect(body.total_plays).toBe(5);
    expect(body.entries.find((e) => e.id === 1)).toMatchObject({ click_count: 2, play_count: 5 });
  });

  it("includes play counts on startup videos and feed payloads", async () => {
    const videosRes = await runWorker(new Request("http://example.com/api/startups/1/videos"));
    const videosBody = (await videosRes.json()) as {
      startup: { click_count: number; play_count: number };
      videos: Array<{ play_count: number }>;
    };
    expect(videosBody.startup.click_count).toBe(2);
    expect(videosBody.startup.play_count).toBe(5);
    expect(videosBody.videos.map((v) => v.play_count)).toEqual([2, 3]);

    const feedRes = await runWorker(new Request("http://example.com/api/feed"));
    const feedBody = (await feedRes.json()) as {
      videos: Array<{
        play_count: number;
        startup: { click_count: number; play_count: number };
      }>;
      total_clicks: number;
      total_plays: number;
    };
    expect(feedBody.total_clicks).toBe(2);
    expect(feedBody.total_plays).toBe(5);
    const alphaFeedVideo = feedBody.videos.find((video) => video.startup.click_count === 2);
    expect(alphaFeedVideo).toMatchObject({
      play_count: 2,
      startup: { click_count: 2, play_count: 5 },
    });
  });
});

describe("rankCardShowsAboutLink", () => {
  it("hides duplicate about-link when name matches host", () => {
    expect(rankCardShowsAboutLink("alpha.io", "alpha.io")).toBe(false);
    expect(rankCardShowsAboutLink("Alpha.io", "alpha.io")).toBe(false);
  });

  it("shows about-link when name differs from host", () => {
    expect(rankCardShowsAboutLink("Alpha", "alpha.io")).toBe(true);
  });
});
