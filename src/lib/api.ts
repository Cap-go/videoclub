export type BoardPeriod = "all" | "today";

export type ReportReason = "ai" | "not_founder" | "no_product_link" | "other";

export interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  founder_name: string | null;
  name_unconfirmed: boolean;
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
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
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

export function checkVideo(videoUrl: string) {
  return api<{
    emailRequired: boolean;
    founderNameRequired?: boolean;
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

export function submitVideo(videoUrl: string, email?: string, founderName?: string) {
  return api<{
    ok: boolean;
    startup: {
      id: number;
      name: string;
      founder_name: string | null;
      name_unconfirmed: boolean;
      product_url: string;
      rank: number;
    };
    video: { title: string; platform: string; url: string; publishedAt: string | null };
  }>("/api/submit", {
    method: "POST",
    body: JSON.stringify({ videoUrl, email: email || undefined, founderName: founderName || undefined }),
  });
}

export function reportVideo(videoId: number, reason: ReportReason = "ai") {
  return api<{ ok: boolean; message: string }>(`/api/report/${videoId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface EmailPreview {
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
