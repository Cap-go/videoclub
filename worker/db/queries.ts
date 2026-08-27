import type { BoardPeriod, LeaderboardEntry, StartupRow, VideoRow } from "../types";

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

/** Today board: platform publish in last 24h, or unknown publish + submitted in last 24h. */
export function todayVideoSql(cutoffIso: string): string {
  return `(v.published_at >= ? OR (v.published_at IS NULL AND v.created_at >= ?))`;
}

export function getBoardCutoffIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function getLeaderboard(
  db: D1Database,
  period: BoardPeriod = "all",
): Promise<LeaderboardEntry[]> {
  const cutoff = getBoardCutoffIso();
  const todayFilter = period === "today" ? `AND ${todayVideoSql(cutoff)}` : "";

  const result = await db
    .prepare(
      `SELECT
        s.id,
        s.name,
        s.product_url,
        s.product_host,
        COUNT(v.id) AS video_count,
        MIN(COALESCE(v.published_at, v.created_at)) AS first_video_at
      FROM startups s
      JOIN videos v ON v.startup_id = s.id AND v.removed_at IS NULL
      WHERE s.removed_at IS NULL
      ${todayFilter}
      GROUP BY s.id
      HAVING video_count > 0
      ORDER BY video_count DESC, first_video_at ASC`,
    )
    .bind(...(period === "today" ? [cutoff, cutoff] : []))
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

export async function getChallengeCount(db: D1Database, videoId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM challenges WHERE video_id = ?")
    .bind(videoId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function hasChallengedVideo(
  db: D1Database,
  videoId: number,
  ipHash: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM challenges WHERE video_id = ? AND ip_hash = ? LIMIT 1")
    .bind(videoId, ipHash)
    .first();
  return !!row;
}

export async function getVideosWithChallengeCounts(
  db: D1Database,
  startupId: number,
): Promise<Array<VideoRow & { challenge_count: number }>> {
  const result = await db
    .prepare(
      `SELECT v.*,
        (SELECT COUNT(*) FROM challenges c WHERE c.video_id = v.id) AS challenge_count
       FROM videos v
       WHERE v.startup_id = ? AND v.removed_at IS NULL
       ORDER BY v.created_at DESC`,
    )
    .bind(startupId)
    .all<VideoRow & { challenge_count: number }>();
  return (result.results ?? []).map((v) => ({
    ...v,
    challenge_count: Number(v.challenge_count),
  }));
}

export async function getStartupRank(
  db: D1Database,
  startupId: number,
  period: BoardPeriod = "all",
): Promise<number | null> {
  const board = await getLeaderboard(db, period);
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

export async function getVideoByPlatformId(
  db: D1Database,
  platform: string,
  videoId: string,
): Promise<VideoRow | null> {
  return db
    .prepare("SELECT * FROM videos WHERE platform = ? AND video_id = ?")
    .bind(platform, videoId)
    .first<VideoRow>();
}

export async function getVideoById(db: D1Database, videoId: number): Promise<VideoRow | null> {
  return db.prepare("SELECT * FROM videos WHERE id = ?").bind(videoId).first<VideoRow>();
}
