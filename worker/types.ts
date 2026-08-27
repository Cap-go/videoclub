export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EMAIL?: SendEmail;
  APP_URL: string;
  EMAIL_FROM: string;
}

export type BoardPeriod = "all" | "today";

export interface StartupRow {
  id: number;
  product_url: string;
  product_host: string;
  name: string;
  founder_name: string | null;
  name_unconfirmed: number;
  email: string;
  created_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  last_notified_rank: number | null;
}

export interface VideoRow {
  id: number;
  startup_id: number;
  video_url: string;
  video_id: string | null;
  platform: string;
  title: string;
  description: string;
  thumbnail: string | null;
  author: string | null;
  product_url_found: string;
  published_at: string | null;
  created_at: string;
  removed_at: string | null;
}

export interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  product_url: string;
  product_host: string;
  video_count: number;
  first_video_at: string;
}

export interface VideoMetadata {
  platform: "youtube" | "tiktok" | "instagram";
  videoId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  author: string | null;
  publishedAt: string | null;
  normalizedUrl: string;
}

export type EmailKind = "welcome" | "rank_changed" | "challenged" | "removed";

export interface EmailPayload {
  kind: EmailKind;
  to: string;
  startupName: string;
  productUrl: string;
  rank?: number;
  previousRank?: number | null;
  videoUrl?: string;
  videoTitle?: string;
  challengeReason?: string;
  challengeCount?: number;
  removalReason?: string;
}
