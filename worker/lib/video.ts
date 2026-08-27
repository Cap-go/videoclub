import type { VideoMetadata } from "../types";
import { resolvePlatformAccount } from "./platform-account";
import { detectPlatform, extractPlatformVideoId, normalizeVideoUrl, type VideoPlatform } from "./urls";

const USER_AGENT =
  "Mozilla/5.0 (compatible; VideoClubBot/1.0; +https://videoclub.lol)";

export async function fetchVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
  const platform = detectPlatform(videoUrl);
  if (!platform) {
    throw new Error("Only YouTube, TikTok, and Instagram video URLs are supported.");
  }

  const videoId = extractPlatformVideoId(videoUrl, platform);
  if (!videoId) {
    throw new Error("Could not parse a video id from that URL.");
  }

  const normalizedUrl = normalizeVideoUrl(videoUrl, platform);
  const oembed = await fetchOembed(normalizedUrl, platform);
  let noembed: OembedResult = {};
  let description = oembed.description ?? "";
  let publishedAt: string | null = null;

  if (platform === "youtube") {
    const innertube = await fetchYouTubeInnertubeDetails(videoId);
    if (innertube.description) description = innertube.description;
    if (innertube.publishedAt) publishedAt = innertube.publishedAt;
    if (!description.trim()) {
      const page = await fetchPageDetails(normalizedUrl, platform);
      description = page.description;
      publishedAt = publishedAt ?? page.publishedAt;
    }
  } else if (!description.trim()) {
    const page = await fetchPageDetails(normalizedUrl, platform);
    description = page.description;
    publishedAt = page.publishedAt;
  } else {
    const page = await fetchPageDetails(normalizedUrl, platform);
    publishedAt = page.publishedAt;
  }

  if (!description.trim()) {
    noembed = await fetchNoembed(normalizedUrl);
    description = noembed.description ?? description;
  }

  if (!description.trim()) {
    throw new Error(
      "We couldn't read the video description. Add a product link in the description and try again.",
    );
  }

  return {
    platform,
    videoId,
    title: oembed.title || noembed.title || "Untitled video",
    description,
    thumbnail: oembed.thumbnail ?? noembed.thumbnail ?? null,
    author: oembed.author ?? noembed.author ?? null,
    authorUrl: oembed.authorUrl ?? noembed.authorUrl ?? null,
    platformAccount: resolvePlatformAccount(platform, {
      author: oembed.author ?? noembed.author ?? null,
      authorUrl: oembed.authorUrl ?? noembed.authorUrl ?? null,
    }),
    publishedAt,
    normalizedUrl,
  };
}

interface OembedResult {
  title?: string;
  description?: string;
  thumbnail?: string;
  author?: string;
  authorUrl?: string;
}

async function fetchOembed(url: string, platform: VideoPlatform): Promise<OembedResult> {
  const endpoints: Record<VideoPlatform, string> = {
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    instagram: `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`,
  };

  try {
    const res = await fetch(endpoints[platform], {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === "string" ? data.title : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      thumbnail:
        typeof data.thumbnail_url === "string"
          ? data.thumbnail_url
          : typeof data.thumbnail === "string"
            ? data.thumbnail
            : undefined,
      author: typeof data.author_name === "string" ? data.author_name : undefined,
      authorUrl: typeof data.author_url === "string" ? data.author_url : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchNoembed(url: string): Promise<OembedResult> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === "string" ? data.title : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      thumbnail: typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined,
      author: typeof data.author_name === "string" ? data.author_name : undefined,
      authorUrl: typeof data.author_url === "string" ? data.author_url : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchYouTubeInnertubeDetails(
  videoId: string,
): Promise<{ description: string; publishedAt: string | null }> {
  const clients = [
    { clientName: "ANDROID", clientVersion: "20.10.38" },
    { clientName: "WEB", clientVersion: "2.20240101.00.00" },
  ];

  for (const client of clients) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          context: { client },
          videoId,
        }),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as Record<string, unknown>;
      const videoDetails = data.videoDetails as Record<string, unknown> | undefined;
      const shortDescription =
        typeof videoDetails?.shortDescription === "string" ? videoDetails.shortDescription : "";
      const microformat = data.microformat as Record<string, unknown> | undefined;
      const playerMicroformat = microformat?.playerMicroformatRenderer as
        | Record<string, unknown>
        | undefined;
      const publishDate =
        typeof playerMicroformat?.publishDate === "string" ? playerMicroformat.publishDate : null;

      if (shortDescription.trim()) {
        return {
          description: shortDescription,
          publishedAt: publishDate ? normalizePublishedAt(publishDate) : null,
        };
      }
    } catch {
      /* try next client */
    }
  }

  return { description: "", publishedAt: null };
}

async function fetchPageDetails(
  url: string,
  platform: VideoPlatform,
): Promise<{ description: string; publishedAt: string | null }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) return { description: "", publishedAt: null };
  const html = await res.text();
  return {
    description: parseDescriptionFromHtml(html, platform),
    publishedAt: parsePublishedAtFromHtml(html, platform),
  };
}

function extractYouTubeDescription(html: string): string {
  const parts: string[] = [];

  const shortDesc = html.match(/"shortDescription"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (shortDesc?.[1]) parts.push(decodeJsonString(shortDesc[1]));

  const attributed = html.match(/"attributedDescriptionBodyText"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (attributed?.[1]) parts.push(decodeJsonString(attributed[1]));

  const attributedSimple = html.match(
    /"attributedDescription"\s*:\s*\{\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (attributedSimple?.[1]) parts.push(decodeJsonString(attributedSimple[1]));

  const navUrls = extractYouTubeNavigationUrls(html);
  if (navUrls.length) parts.push(navUrls.join("\n"));

  const combined = parts.filter(Boolean).join("\n");
  if (combined.trim()) return combined;

  const og = extractMetaDescription(html);
  if (og && !og.includes(" - YouTube")) return og;

  const descMatch = html.match(/"description"\s*:\s*\{\s*"simpleText"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (descMatch?.[1]) return decodeJsonString(descMatch[1]);

  return "";
}

/** Test helper: extract navigation URLs from YouTube HTML (Shorts link cards, etc.) */
export function extractYouTubeNavigationUrls(html: string): string[] {
  const urls = new Set<string>();

  const urlEndpointRe = /"urlEndpoint"\s*:\s*\{\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(urlEndpointRe)) {
    if (match[1]) urls.add(decodeJsonString(match[1]));
  }

  const commandUrlRe = /"commandMetadata"\s*:\s*\{[^}]*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(commandUrlRe)) {
    if (match[1]) urls.add(decodeJsonString(match[1]));
  }

  const webCommandRe = /"webCommandMetadata"\s*:\s*\{[^}]*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(webCommandRe)) {
    if (match[1]) {
      const decoded = decodeJsonString(match[1]);
      if (decoded.startsWith("http")) urls.add(decoded);
    }
  }

  return [...urls];
}

function extractTikTokDescription(html: string): string {
  const sigi = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (sigi?.[1]) {
    try {
      const state = JSON.parse(sigi[1]) as Record<string, unknown>;
      const desc = findStringByKeys(state, ["desc", "description", "text"]);
      if (desc) return desc;
    } catch {
      /* ignore */
    }
  }

  const universal = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (universal?.[1]) {
    try {
      const state = JSON.parse(universal[1]) as Record<string, unknown>;
      const desc = findStringByKeys(state, ["desc", "description", "text"]);
      if (desc) return desc;
    } catch {
      /* ignore */
    }
  }

  return extractMetaDescription(html) ?? "";
}

function extractMetaDescription(html: string): string | null {
  const og = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
  if (og?.[1]) return decodeHtmlEntities(og[1]);
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (meta?.[1]) return decodeHtmlEntities(meta[1]);
  return null;
}

function extractJsonDescription(html: string, keys: string[]): string {
  for (const key of keys) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i");
    const match = html.match(re);
    if (match?.[1]) return decodeJsonString(match[1]);
  }
  return "";
}

function findStringByKeys(obj: unknown, keys: string[], depth = 0): string | null {
  if (depth > 12 || obj == null) return null;
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (keys.includes(key) && typeof value === "string" && value.trim()) {
        return value;
      }
      const nested = findStringByKeys(value, keys, depth + 1);
      if (nested) return nested;
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const nested = findStringByKeys(item, keys, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function decodeJsonString(input: string): string {
  try {
    return JSON.parse(`"${input.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return input.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Test helper: parse description without network */
export function parseDescriptionFromHtml(html: string, platform: VideoPlatform): string {
  if (platform === "youtube") return extractYouTubeDescription(html);
  if (platform === "tiktok") return extractTikTokDescription(html);
  return extractMetaDescription(html) ?? extractJsonDescription(html, ["caption", "description", "text"]);
}

/** Test helper: parse publish date without network */
export function parsePublishedAtFromHtml(html: string, platform: VideoPlatform): string | null {
  if (platform === "youtube") {
    const upload = html.match(/"uploadDate"\s*:\s*"([^"]+)"/);
    if (upload?.[1]) return normalizePublishedAt(upload[1]);
    const published = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (published?.[1]) return normalizePublishedAt(published[1]);
    const item = html.match(/itemprop="datePublished"\s+content="([^"]+)"/);
    if (item?.[1]) return normalizePublishedAt(item[1]);
  }

  if (platform === "tiktok") {
    const epoch = html.match(/"createTime"\s*:\s*"?(\d{10})"?/);
    if (epoch?.[1]) return new Date(Number(epoch[1]) * 1000).toISOString();
  }

  if (platform === "instagram") {
    const epoch = html.match(/"taken_at_timestamp"\s*:\s*(\d{10})/);
    if (epoch?.[1]) return new Date(Number(epoch[1]) * 1000).toISOString();
  }

  return null;
}

function normalizePublishedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}
