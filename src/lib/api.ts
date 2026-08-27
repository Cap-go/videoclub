export type BoardPeriod = "all" | "today";

export type ChallengeReason = "ai" | "not_founder" | "not_real_product";

export interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  product_url: string;
  product_host: string;
  video_count: number;
  first_video_at: string;
}

export interface StartupVideo {
  id: number;
  video_url: string;
  platform: string;
  title: string;
  thumbnail: string | null;
  published_at: string | null;
  submitted_at: string;
  challenge_count: number;
}

export interface FeedVideo {
  id: number;
  video_id: string | null;
  video_url: string;
  platform: string;
  title: string;
  thumbnail: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
  submitted_at: string;
  product_url: string;
  startup: {
    id: number;
    name: string;
    product_host: string;
    rank: number | null;
  };
  challenge_count: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function getLeaderboard(period: BoardPeriod = "all") {
  return api<{ period: BoardPeriod; entries: LeaderboardEntry[] }>(
    `/api/leaderboard?period=${period}`,
  );
}

export function getStartupVideos(id: number) {
  return api<{
    startup: { id: number; name: string; product_url: string; product_host: string };
    videos: StartupVideo[];
  }>(`/api/startups/${id}/videos`);
}

export function getFeed(cursor?: string, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return api<{ videos: FeedVideo[]; nextCursor: string | null }>(`/api/feed?${params}`);
}

export function checkVideo(videoUrl: string) {
  return api<{
    emailRequired: boolean;
    productFound: boolean;
    duplicate?: boolean;
    productUrl?: string;
    productHost?: string;
    startupName?: string;
    publishedAt?: string | null;
    error?: string;
  }>("/api/check", {
    method: "POST",
    body: JSON.stringify({ videoUrl }),
  });
}

export function submitVideo(videoUrl: string, email?: string, options?: { force?: boolean }) {
  return api<{
    ok: boolean;
    startup: { id: number; name: string; product_url: string; rank: number };
    video: { title: string; platform: string; url: string; publishedAt: string | null };
  }>("/api/submit", {
    method: "POST",
    body: JSON.stringify({
      videoUrl,
      email: email || undefined,
      force: options?.force === true ? true : undefined,
    }),
  });
}

export function challengeVideo(videoId: number, reason: ChallengeReason = "ai") {
  return api<{ ok: boolean; challengeCount: number; removed: boolean; message: string }>(
    `/api/challenge/${videoId}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

export interface EmailPreview {
  id?: string;
  kind: string;
  subject: string;
  text: string;
  html: string;
}

export function getEmailPreviews() {
  return api<{ previews: EmailPreview[] }>("/api/dev/email-previews");
}

export function faviconUrl(host: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}
