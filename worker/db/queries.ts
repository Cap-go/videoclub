import type { LeaderboardEntry, StartupRow, VideoRow } from "../types";

export interface RankedStartup {
  id: number;
  rank: number;
  video_count: number;
  first_video_at: string;
}

export function computeRanks(
  rows: Array<{ id: number; video_count: number; first_video_at: string }>,
): RankedStartup[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.video_count !== a.video_count) return b.video_count - a.video_count;
    return a.first_video_at.localeCompare(b.first_video_at);
  });

  return sorted.map((row, index) => ({
    id: row.id,
    rank: index + 1,
    video_count: row.video_count,
    first_video_at: row.first_video_at,
  }));
}

export async function getLeaderboard(db: D1Database): Promise<LeaderboardEntry[]> {
  const result = await db
    .prepare(
      `SELECT
        s.id,
        s.name,
        s.product_url,
        s.product_host,
        COUNT(v.id) AS video_count,
        MIN(v.created_at) AS first_video_at
      FROM startups s
      JOIN videos v ON v.startup_id = s.id AND v.removed_at IS NULL
      WHERE s.removed_at IS NULL
      GROUP BY s.id
      ORDER BY video_count DESC, first_video_at ASC`,
    )
    .all<Omit<LeaderboardEntry, "rank">>();

  const rows = result.results ?? [];
  const ranked = computeRanks(
    rows.map((r) => ({
      id: r.id,
      video_count: Number(r.video_count),
      first_video_at: r.first_video_at,
    })),
  );

  const rankMap = new Map(ranked.map((r) => [r.id, r.rank]));
  return rows.map((row) => ({
    ...row,
    video_count: Number(row.video_count),
    rank: rankMap.get(row.id) ?? 0,
  }));
}

export async function getStartupRank(db: D1Database, startupId: number): Promise<number | null> {
  const board = await getLeaderboard(db);
  const entry = board.find((e) => e.id === startupId);
  return entry?.rank ?? null;
}

export async function getStartupByHost(
  db: D1Database,
  productHost: string,
): Promise<StartupRow | null> {
  return db
    .prepare("SELECT * FROM startups WHERE product_host = ? AND removed_at IS NULL")
    .bind(productHost)
    .first<StartupRow>();
}

export async function getStartupByHostIncludingRemoved(
  db: D1Database,
  productHost: string,
): Promise<StartupRow | null> {
  return db
    .prepare("SELECT * FROM startups WHERE product_host = ?")
    .bind(productHost)
    .first<StartupRow>();
}

export async function getStartupById(db: D1Database, id: number): Promise<StartupRow | null> {
  return db.prepare("SELECT * FROM startups WHERE id = ?").bind(id).first<StartupRow>();
}

export async function getVideosForStartup(db: D1Database, startupId: number): Promise<VideoRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM videos WHERE startup_id = ? AND removed_at IS NULL ORDER BY created_at DESC",
    )
    .bind(startupId)
    .all<VideoRow>();
  return result.results ?? [];
}

export async function getVideoByUrl(db: D1Database, videoUrl: string): Promise<VideoRow | null> {
  return db.prepare("SELECT * FROM videos WHERE video_url = ?").bind(videoUrl).first<VideoRow>();
}

export async function getVideoById(db: D1Database, videoId: number): Promise<VideoRow | null> {
  return db.prepare("SELECT * FROM videos WHERE id = ?").bind(videoId).first<VideoRow>();
}
