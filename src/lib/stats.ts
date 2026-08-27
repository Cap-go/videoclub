const DEBOUNCE_MS = 30_000;

function debounceKey(kind: "click" | "play", id: number): string {
  return `vc-${kind}-${id}`;
}

function shouldRecord(kind: "click" | "play", id: number): boolean {
  if (typeof window === "undefined") return true;
  const key = debounceKey(kind, id);
  const lastRaw = window.localStorage.getItem(key);
  const now = Date.now();
  if (lastRaw) {
    const last = Number(lastRaw);
    if (Number.isFinite(last) && now - last < DEBOUNCE_MS) return false;
  }
  window.localStorage.setItem(key, String(now));
  return true;
}

async function postJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface StartupClickResult {
  ok: boolean;
  click_count: number;
  total_clicks: number;
}

export interface VideoPlayResult {
  ok: boolean;
  play_count: number;
  startup_play_count: number;
  total_plays: number;
}

export async function recordStartupClick(startupId: number): Promise<StartupClickResult | null> {
  if (!shouldRecord("click", startupId)) return null;
  return postJson<StartupClickResult>(`/api/startups/${startupId}/click`);
}

export async function recordVideoPlay(videoId: number): Promise<VideoPlayResult | null> {
  if (!shouldRecord("play", videoId)) return null;
  return postJson<VideoPlayResult>(`/api/videos/${videoId}/play`);
}

export function formatStatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

/** When startup name equals product host, only show one product link (in title). */
export function rankCardShowsAboutLink(name: string, host: string): boolean {
  return name.toLowerCase() !== host.toLowerCase();
}
