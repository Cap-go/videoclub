export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_URL: string;
  EMAIL_FROM: string;
  RESEND_API_KEY?: string;
}

export interface StartupRow {
  id: number;
  product_url: string;
  product_host: string;
  name: string;
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
  platform: string;
  title: string;
  description: string;
  thumbnail: string | null;
  author: string | null;
  product_url_found: string;
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
  title: string;
  description: string;
  thumbnail: string | null;
  author: string | null;
  normalizedUrl: string;
}

export type EmailKind = "welcome" | "rank_changed" | "removed";

export interface EmailPayload {
  kind: EmailKind;
  to: string;
  startupName: string;
  productUrl: string;
  rank?: number;
  previousRank?: number | null;
  videoUrl?: string;
  videoTitle?: string;
}
