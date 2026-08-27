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
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "t.co",
  "pic.x.com",
  "pic.twitter.com",
  "goo.gle",
  "g.co",
  "blog.google",
  "google",
]);

const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.x.com", "mobile.twitter.com"]);

/** Platform/vendor chrome — exact host or any subdomain (e.g. support.google.com). */
const BLOCKED_PARENT_DOMAINS = [
  "google.com",
  "withgoogle.com",
  "apple.com",
  "facebook.com",
  "microsoft.com",
];

const BIG_TECH_GOOGLE_HOSTS = new Set(["goo.gle", "g.co", "blog.google", "google"]);
const BIG_TECH_GOOGLE_PARENT_DOMAINS = ["google.com", "withgoogle.com"];

function parseProductHost(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    const cleaned = input.trim().toLowerCase().replace(/^www\./, "");
    const host = cleaned.split("/")[0]?.split(":")[0];
    if (!host || host.includes(" ") || host.includes("@")) return null;
    return host;
  }
}

function isBigTechGoogleHost(host: string): boolean {
  if (BIG_TECH_GOOGLE_HOSTS.has(host)) return true;
  return BIG_TECH_GOOGLE_PARENT_DOMAINS.some(
    (parent) => host === parent || host.endsWith(`.${parent}`),
  );
}

/** True when a URL/host is a blocked Google / Big Tech product listing (for user-facing errors). */
export function isRejectedBigTechProductUrl(input: string): boolean {
  const host = parseProductHost(input);
  return host != null && isBigTechGoogleHost(host);
}

function isBlockedProductHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`www.${host}`)) return true;
  return BLOCKED_PARENT_DOMAINS.some((parent) => host === parent || host.endsWith(`.${parent}`));
}

export function normalizeProductHost(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (!host || host.includes(" ")) return null;
    if (isBlockedProductHost(host)) return null;
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
    return `${url.protocol}//${host}`;
  } catch {
    return null;
  }
}

const URL_REGEX = /https?:\/\/[^\s<>"')\]}]+/gi;
const BARE_DOMAIN_REGEX =
  /(?:^|[\s([{"'])((?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?::\d+)?(?:\/[^\s<>"')\]}]*)?)/gi;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:!?)}\]]+$/g, "");
}

function isBlockedProductUrl(urlStr: string): boolean {
  const host = normalizeProductHost(urlStr);
  return !host;
}

function tryNormalizeProductUrl(candidate: string): string | null {
  const cleaned = cleanUrl(candidate);
  if (!cleaned || isBlockedProductUrl(cleaned)) return null;
  return normalizeProductUrl(cleaned);
}

/** All valid product URLs in description order, deduped by normalized host. */
export function extractProductUrls(description: string): string[] {
  if (!description) return [];

  const seenHosts = new Set<string>();
  const urls: string[] = [];

  const addCandidate = (raw: string) => {
    const normalized = tryNormalizeProductUrl(raw);
    if (!normalized) return;
    const host = normalizeProductHost(normalized);
    if (!host || seenHosts.has(host)) return;
    seenHosts.add(host);
    urls.push(normalized);
  };

  for (const match of description.match(URL_REGEX) ?? []) {
    addCandidate(match);
  }

  for (const match of description.matchAll(BARE_DOMAIN_REGEX)) {
    const domain = match[1];
    if (!domain || domain.includes("@")) continue;
    addCandidate(domain);
  }

  return urls;
}

export function extractProductUrl(description: string): string | null {
  return extractProductUrls(description)[0] ?? null;
}

/** First Google / Big Tech product URL in text, including hosts blocked from extraction. */
export function findRejectedBigTechProductUrl(text: string): string | null {
  if (!text) return null;

  for (const match of text.match(URL_REGEX) ?? []) {
    const cleaned = cleanUrl(match);
    if (isRejectedBigTechProductUrl(cleaned)) return cleaned;
  }

  for (const match of text.matchAll(BARE_DOMAIN_REGEX)) {
    const domain = match[1];
    if (!domain || domain.includes("@")) continue;
    const cleaned = cleanUrl(domain);
    if (isRejectedBigTechProductUrl(cleaned)) return cleaned;
  }

  return null;
}

export type VideoPlatform = "youtube" | "tiktok" | "instagram" | "x";

export const SUPPORTED_PLATFORMS_MESSAGE = "YouTube, TikTok, Instagram, and X";

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
    if (X_HOSTS.has(host)) {
      return "x";
    }
    return null;
  } catch {
    return null;
  }
}

/** Canonical platform video id — dedup key across URL variants. */
export function extractPlatformVideoId(url: string, platform: VideoPlatform): string | null {
  try {
    const parsed = new URL(url);
    if (platform === "youtube") {
      const shorts = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts?.[1]) return shorts[1];

      const embed = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed?.[1]) return embed[1];

      const v = parsed.searchParams.get("v");
      if (v) return v;

      if (parsed.hostname.replace(/^www\./, "").includes("youtu.be")) {
        const id = parsed.pathname.slice(1).split("/")[0]?.split("?")[0];
        if (id) return id;
      }
      return null;
    }

    if (platform === "tiktok") {
      const match = parsed.pathname.match(/\/video\/(\d+)/);
      return match?.[1] ?? null;
    }

    if (platform === "instagram") {
      const match = parsed.pathname.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
      return match?.[1] ?? null;
    }

    if (platform === "x") {
      const status = parsed.pathname.match(/\/status\/(\d+)/);
      if (status?.[1]) return status[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeVideoUrl(url: string, platform: VideoPlatform): string {
  const videoId = extractPlatformVideoId(url, platform);
  if (platform === "youtube" && videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  if (platform === "tiktok" && videoId) {
    const parsed = new URL(url);
    const userMatch = parsed.pathname.match(/^\/@([^/]+)\/video\//);
    if (userMatch?.[1]) {
      return `https://www.tiktok.com/@${userMatch[1]}/video/${videoId}`;
    }
    return `https://www.tiktok.com/video/${videoId}`;
  }
  if (platform === "instagram" && videoId) {
    const parsed = new URL(url);
    const kind = parsed.pathname.includes("/p/") ? "p" : "reel";
    return `https://www.instagram.com/${kind}/${videoId}/`;
  }
  if (platform === "x" && videoId) {
    return `https://x.com/i/status/${videoId}`;
  }

  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
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

export const DUPLICATE_VIDEO_MESSAGE =
  "This video is already on Video Club. Each video counts once — the product link in its description locks attribution.";
