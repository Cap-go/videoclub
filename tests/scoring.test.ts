import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getLeaderboard } from "../worker/db/queries";
import { initTestDb } from "./schema";

describe("today vs all-time boards", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();

    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES
         (1, 'https://old.io', 'old.io', 'Old', 'old@test.com', '2020-01-01T00:00:00.000Z'),
         (2, 'https://fresh.io', 'fresh.io', 'Fresh', 'fresh@test.com', '2026-01-01T00:00:00.000Z')`,
    ).run();

    const oldPublished = "2019-01-01T00:00:00.000Z";
    const recentPublished = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oldSubmitted = "2026-01-01T00:00:00.000Z";
    const recentSubmitted = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO videos (id, startup_id, video_url, video_id, platform, title, description, product_url_found, published_at, created_at)
       VALUES
         (1, 1, 'https://youtube.com/watch?v=old1', 'old1', 'youtube', 'Old 1', 'https://old.io', 'https://old.io', ?, ?),
         (2, 1, 'https://youtube.com/watch?v=old2', 'old2', 'youtube', 'Old 2', 'https://old.io', 'https://old.io', ?, ?),
         (3, 2, 'https://youtube.com/watch?v=new1', 'new1', 'youtube', 'New 1', 'https://fresh.io', 'https://fresh.io', ?, ?),
         (4, 2, 'https://tiktok.com/@x/video/999', '999', 'tiktok', 'New TikTok', 'https://fresh.io', 'https://fresh.io', NULL, ?)`,
    )
      .bind(oldPublished, oldSubmitted, oldPublished, recentSubmitted, recentPublished, recentSubmitted, recentSubmitted)
      .run();
  });

  it("all-time counts every valid video including back catalog", async () => {
    const board = await getLeaderboard(env.DB, "all");
    expect(board.find((e) => e.id === 1)?.video_count).toBe(2);
    expect(board.find((e) => e.id === 2)?.video_count).toBe(2);
    expect(board[0]?.id).toBe(1);
  });

  it("today only counts recently published or unknown-publish submissions", async () => {
    const board = await getLeaderboard(env.DB, "today");
    expect(board.find((e) => e.id === 1)).toBeUndefined();
    expect(board.find((e) => e.id === 2)?.video_count).toBe(2);
    expect(board[0]?.id).toBe(2);
  });
});
