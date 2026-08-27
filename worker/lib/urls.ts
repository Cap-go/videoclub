const BLOCKED_HOSTS = new Set([
  "youtube.com",
  "youtu.be",
  "www.youtube.com",
  "m.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
]);

export function normalizeProductHost(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (!host || host.includes(" ")) return null;
    if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`www.${host}`)) return null;
    return host;
  } catch {
    return null;
  }
}

export function normalizeProductUrl(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = normalizeProductHost(url.href);
    if (!host) return null;
    url.hostname = host;
    url.hash = "";
    return url.toString().replace(/\/$/, "") || url.toString();
  } catch {
    return null;
  }
}

const URL_REGEX =
  /https?:\/\/[^\s<>"')\]}]+/gi;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:!?)}\]]+$/g, "");
}

function isBlockedProductUrl(urlStr: string): boolean {
  const host = normalizeProductHost(urlStr);
  return !host;
}

export function extractProductUrl(description: string): string | null {
  if (!description) return null;
  const matches = description.match(URL_REGEX) ?? [];
  for (const match of matches) {
    const cleaned = cleanUrl(match);
    if (!isBlockedProductUrl(cleaned)) {
      const normalized = normalizeProductUrl(cleaned);
      if (normalized) return normalized;
    }
  }
  return null;
}

export type VideoPlatform = "youtube" | "tiktok" | "instagram";

export function detectPlatform(url: string): VideoPlatform | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      return "youtube";
    }
    if (host === "tiktok.com" || host === "vm.tiktok.com") {
      return "tiktok";
    }
    if (host === "instagram.com" || host === "instagr.am") {
      return "instagram";
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeVideoUrl(url: string, platform: VideoPlatform): string {
  const parsed = new URL(url);
  parsed.hash = "";
  if (platform === "youtube") {
    const videoId =
      parsed.searchParams.get("v") ??
      (parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1).split("/")[0] : null);
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  if (platform === "tiktok") {
    parsed.search = "";
  }
  return parsed.toString().replace(/\/$/, "");
}

export function hostToName(host: string): string {
  const base = host.split(".")[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function hashIp(ip: string, salt = "videoclub"): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
