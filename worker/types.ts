export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EMAIL?: SendEmail;
  BROWSER?: BrowserRun;
  APP_URL: string;
  EMAIL_FROM: string;
  /** Optional fetch-relay when platforms block the Worker IP. */
  PROXY_URL?: string;
  /** Optional fallback when InnerTube/HTML scraping is blocked by YouTube. */
  YOUTUBE_API_KEY?: string;
  /** DataFast website API key (`df_`) or account token (`dft_` with analytics:read). */
  DATAFAST_API_KEY?: string;
  /** DataFast website id when using a `dft_` account token. */
  DATAFAST_WEBSITE_ID?: string;
  /** Optional public DataFast share URL for the visitors pill link. */
  DATAFAST_SHARE_URL?: string;
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
  click_count: number;
  play_count: number;
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
  platform_account: string | null;
  product_url_found: string;
  published_at: string | null;
  created_at: string;
  removed_at: string | null;
  play_count: number;
}

export interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  product_url: string;
  product_host: string;
  video_count: number;
  first_video_at: string;
  click_count: number;
  play_count: number;
}

export interface SiteStats {
  total_clicks: number;
  total_plays: number;
}

export interface FeedVideoEntry {
  id: number;
  video_id: string | null;
  platform: string;
  video_url: string;
  title: string;
  thumbnail: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
  product_url: string;
  startup_id: number;
  startup_name: string;
  startup_host: string;
  startup_rank: number | null;
  challenge_count: number;
  play_count: number;
  startup_click_count: number;
  startup_play_count: number;
}

export interface VideoMetadata {
  platform: "youtube" | "tiktok" | "instagram" | "x";
  videoId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  author: string | null;
  publishedAt: string | null;
  normalizedUrl: string;
  platformAccount: string | null;
  authorUrl: string | null;
  /** Resolved product URL (tweet text link or tagged business mention on X). */
  productUrl: string | null;
}

export type EmailKind = "welcome" | "rank_changed" | "challenged" | "removed" | "foreign_account_review";

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
  productHost?: string;
  platform?: string;
  lockedAccount?: string;
  submittedAccount?: string;
  submitterEmail?: string;
  submittedAt?: string;
}
