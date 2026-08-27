import type { VideoMetadata } from "../types";
import { resolvePlatformAccount } from "./platform-account";
import { isHttpBlocked, type ProxiedFetchBindings, proxiedFetch } from "./proxied-fetch";
import {
  detectPlatform,
  extractPlatformVideoId,
  extractProductUrl,
  normalizeProductHost,
  normalizeProductUrl,
  normalizeVideoUrl,
  SUPPORTED_PLATFORMS_MESSAGE,
  type VideoPlatform,
} from "./urls";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Required on ANDROID/IOS player requests or YouTube returns "video unavailable". */
const INNERTUBE_PLAYER_PARAMS = "CgIQBg==";

const YOUTUBE_BLOCKED_MESSAGE =
  "We couldn't read the video description. YouTube may be blocking requests from our servers — try again in a few minutes. Make sure your product link is in the video description.";

const YOUTUBE_EMPTY_MESSAGE =
  "We couldn't read the video description. Add a product link in the description and try again.";

const X_NO_VIDEO_MESSAGE = "This tweet has no video. Only video posts on X are supported.";
const X_EMPTY_MESSAGE =
  "We couldn't read the tweet text. Add your product link in the tweet and try again.";
const X_READ_FAILED_MESSAGE =
  "We couldn't verify this X post. Make sure it is a public video tweet with your product link in the text.";

export interface VideoFetchBindings extends ProxiedFetchBindings {
  YOUTUBE_API_KEY?: string;
}

interface OembedResult {
  title?: string;
  description?: string;
  thumbnail?: string;
  author?: string;
  authorUrl?: string;
}

export async function fetchVideoMetadata(
  videoUrl: string,
  bindings: VideoFetchBindings = {},
): Promise<VideoMetadata> {
  const platform = detectPlatform(videoUrl);
  if (!platform) {
    throw new Error(`Only ${SUPPORTED_PLATFORMS_MESSAGE} video URLs are supported.`);
  }

  const videoId = extractPlatformVideoId(videoUrl, platform);
  if (!videoId) {
    throw new Error("Could not parse a video id from that URL.");
  }

  const normalizedUrl = normalizeVideoUrl(videoUrl, platform);

  if (platform === "x") {
    return fetchXVideoMetadata(videoId, normalizedUrl, bindings);
  }

  const oembed = await fetchOembed(normalizedUrl, platform, bindings);
  let noembed: OembedResult = {};
  let description = oembed.description ?? "";
  let publishedAt: string | null = null;
  let youtubeBlocked = false;

  if (platform === "youtube") {
    const innertube = await fetchYouTubeInnertubeDetails(videoId, bindings);
    if (innertube.description) description = innertube.description;
    if (innertube.publishedAt) publishedAt = innertube.publishedAt;
    youtubeBlocked = innertube.blocked;

    if (!description.trim()) {
      const page = await fetchYouTubePageDetails(videoId, normalizedUrl, bindings);
      if (page.description) description = page.description;
      publishedAt = publishedAt ?? page.publishedAt;
      youtubeBlocked = youtubeBlocked || page.blocked;
    }

    if (!description.trim() && bindings.YOUTUBE_API_KEY) {
      const api = await fetchYouTubeDataApiDetails(videoId, bindings.YOUTUBE_API_KEY, bindings);
      if (api.description) description = api.description;
      publishedAt = publishedAt ?? api.publishedAt;
    }
  } else if (!description.trim()) {
    const page = await fetchPageDetails(normalizedUrl, platform, bindings);
    description = page.description;
    publishedAt = page.publishedAt;
  } else {
    const page = await fetchPageDetails(normalizedUrl, platform, bindings);
    publishedAt = page.publishedAt;
  }

  if (!description.trim()) {
    noembed = await fetchNoembed(normalizedUrl, bindings);
    description = noembed.description ?? description;
  }

  if (!description.trim()) {
    throw new Error(youtubeBlocked ? YOUTUBE_BLOCKED_MESSAGE : YOUTUBE_EMPTY_MESSAGE);
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
    productUrl: extractProductUrl(description),
  };
}

async function fetchOembed(
  url: string,
  platform: Exclude<VideoPlatform, "x">,
  bindings: VideoFetchBindings,
): Promise<OembedResult> {
  const endpoints: Record<Exclude<VideoPlatform, "x">, string> = {
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    instagram: `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`,
  };

  try {
    const { response: res } = await proxiedFetch(endpoints[platform], bindings, {
      init: { headers: { Accept: "application/json" } },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    return parseOembedJson(data);
  } catch {
    return {};
  }
}

async function fetchNoembed(url: string, bindings: VideoFetchBindings): Promise<OembedResult> {
  try {
    const { response: res } = await proxiedFetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      bindings,
      { init: { headers: { Accept: "application/json" } } },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, unknown>;
    return parseOembedJson(data);
  } catch {
    return {};
  }
}

function parseOembedJson(data: Record<string, unknown>): OembedResult {
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
}

interface InnertubeClientConfig {
  client: Record<string, unknown>;
  userAgent: string;
  params?: string;
  thirdParty?: { embedUrl: string };
}

function innertubeClientConfigs(videoId: string): InnertubeClientConfig[] {
  return [
    {
      client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        androidSdkVersion: 33,
        hl: "en",
        gl: "US",
        osName: "Android",
        osVersion: "13",
      },
      userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 13) gzip",
      params: INNERTUBE_PLAYER_PARAMS,
    },
    {
      client: {
        clientName: "IOS",
        clientVersion: "20.10.4",
        deviceMake: "Apple",
        deviceModel: "iPhone14,3",
        hl: "en",
        gl: "US",
        osName: "iOS",
        osVersion: "17.0",
      },
      userAgent: "com.google.ios.youtube/20.10.4 (iPhone14,3; U; CPU iOS 17_0 like Mac OS X)",
      params: INNERTUBE_PLAYER_PARAMS,
    },
    {
      client: {
        clientName: "WEB_EMBEDDED_PLAYER",
        clientVersion: "2.20250220.01.00",
        hl: "en",
        gl: "US",
      },
      userAgent: CHROME_USER_AGENT,
      thirdParty: { embedUrl: `https://www.youtube.com/embed/${videoId}` },
    },
  ];
}

function isInnertubeBlocked(data: Record<string, unknown>): boolean {
  const status = (data.playabilityStatus as Record<string, unknown> | undefined)?.status;
  if (status === "LOGIN_REQUIRED") return true;
  if (status === "ERROR") {
    const reason = (data.playabilityStatus as Record<string, unknown> | undefined)?.reason;
    return typeof reason === "string" && /bot|sign in|blocked/i.test(reason);
  }
  return false;
}

/** Test helper: build description + publish date from an InnerTube player JSON payload. */
export function parseInnertubePlayerResponse(data: Record<string, unknown>): {
  description: string;
  publishedAt: string | null;
  blocked: boolean;
} {
  const blocked = isInnertubeBlocked(data);
  const videoDetails = data.videoDetails as Record<string, unknown> | undefined;

  const shortDescription =
    typeof videoDetails?.shortDescription === "string" ? videoDetails.shortDescription : "";

  const microformat = data.microformat as Record<string, unknown> | undefined;
  const playerMicroformat = microformat?.playerMicroformatRenderer as Record<string, unknown> | undefined;
  const publishDate =
    typeof playerMicroformat?.publishDate === "string" ? playerMicroformat.publishDate : null;

  return {
    description: shortDescription.trim(),
    publishedAt: publishDate ? normalizePublishedAt(publishDate) : null,
    blocked,
  };
}

async function fetchYouTubeInnertubeDetails(
  videoId: string,
  bindings: VideoFetchBindings,
): Promise<{ description: string; publishedAt: string | null; blocked: boolean }> {
  let blocked = false;

  for (const config of innertubeClientConfigs(videoId)) {
    try {
      const body: Record<string, unknown> = {
        context: {
          client: config.client,
          ...(config.thirdParty ? { thirdParty: config.thirdParty } : {}),
        },
        videoId,
      };
      if (config.params) body.params = config.params;

      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": config.userAgent,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        body: JSON.stringify(body),
      };

      let { response: res, layer } = await proxiedFetch(
        "https://www.youtube.com/youtubei/v1/player",
        bindings,
        { init: requestInit },
      );
      if (!res.ok) continue;

      let data = (await res.json()) as Record<string, unknown>;
      let parsed = parseInnertubePlayerResponse(data);
      blocked = blocked || parsed.blocked;

      if (!parsed.description.trim() && layer === "direct") {
        const retry = await proxiedFetch("https://www.youtube.com/youtubei/v1/player", bindings, {
          forceProxy: true,
          init: requestInit,
        });
        if (retry.response.ok) {
          res = retry.response;
          data = (await res.json()) as Record<string, unknown>;
          parsed = parseInnertubePlayerResponse(data);
          blocked = blocked || parsed.blocked;
        }
      }

      if (parsed.description.trim()) {
        return parsed;
      }
    } catch {
      /* try next client */
    }
  }

  return { description: "", publishedAt: null, blocked };
}

async function fetchYouTubeDataApiDetails(
  videoId: string,
  apiKey: string,
  bindings: VideoFetchBindings,
): Promise<{ description: string; publishedAt: string | null }> {
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", apiKey);

    const { response: res } = await proxiedFetch(url.toString(), bindings, {
      init: { headers: { Accept: "application/json" } },
    });
    if (!res.ok) return { description: "", publishedAt: null };

    const data = (await res.json()) as Record<string, unknown>;
    const items = data.items as Array<Record<string, unknown>> | undefined;
    const snippet = items?.[0]?.snippet as Record<string, unknown> | undefined;
    const description = typeof snippet?.description === "string" ? snippet.description : "";
    const publishedAt =
      typeof snippet?.publishedAt === "string" ? normalizePublishedAt(snippet.publishedAt) : null;

    return { description, publishedAt };
  } catch {
    return { description: "", publishedAt: null };
  }
}

async function fetchYouTubePageDetails(
  videoId: string,
  watchUrl: string,
  bindings: VideoFetchBindings,
): Promise<{ description: string; publishedAt: string | null; blocked: boolean }> {
  const urls = [watchUrl, `https://www.youtube.com/shorts/${videoId}`];
  let blocked = false;

  for (const url of urls) {
    const requestInit: RequestInit = {
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+667",
      },
      redirect: "follow",
    };

    let { response: res, layer } = await proxiedFetch(url, bindings, { init: requestInit });

    if (res.status === 429) {
      blocked = true;
      continue;
    }
    if (!res.ok) continue;

    let html = await res.text();
    if (/consent\.youtube\.com|Sign in to confirm/i.test(html)) {
      blocked = true;
    }

    let result = parseYouTubeHtmlPage(html, blocked);
    blocked = result.blocked;

    if (!result.description.trim() && layer === "direct") {
      const retry = await proxiedFetch(url, bindings, { forceProxy: true, init: requestInit });
      if (retry.response.ok) {
        res = retry.response;
        html = await res.text();
        if (/consent\.youtube\.com|Sign in to confirm/i.test(html)) {
          blocked = true;
        }
        result = parseYouTubeHtmlPage(html, blocked);
        blocked = result.blocked;
      }
    }

    if (result.description.trim()) {
      return result;
    }
  }

  return { description: "", publishedAt: null, blocked };
}

function parseYouTubeHtmlPage(
  html: string,
  blocked: boolean,
): { description: string; publishedAt: string | null; blocked: boolean } {
  const playerResponse = extractYtInitialPlayerResponse(html);
  if (playerResponse) {
    const parsed = parseInnertubePlayerResponse(playerResponse);
    if (parsed.description.trim()) {
      return { ...parsed, blocked: blocked || parsed.blocked };
    }
    blocked = blocked || parsed.blocked;
  }

  const description = parseDescriptionFromHtml(html, "youtube");
  const publishedAt = parsePublishedAtFromHtml(html, "youtube");
  return { description, publishedAt, blocked };
}

function extractYtInitialPlayerResponse(html: string): Record<string, unknown> | null {
  const marker = "ytInitialPlayerResponse";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const braceStart = html.indexOf("{", start);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    const char = html[i];
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(braceStart, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

async function fetchPageDetails(
  url: string,
  platform: VideoPlatform,
  bindings: VideoFetchBindings,
): Promise<{ description: string; publishedAt: string | null }> {
  const requestInit: RequestInit = {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  };

  let { response: res, layer } = await proxiedFetch(url, bindings, { init: requestInit });
  if (!res.ok) return { description: "", publishedAt: null };

  let html = await res.text();
  let description = parseDescriptionFromHtml(html, platform);

  if (!description.trim() && layer === "direct") {
    const retry = await proxiedFetch(url, bindings, { forceProxy: true, init: requestInit });
    if (retry.response.ok) {
      html = await retry.response.text();
      description = parseDescriptionFromHtml(html, platform);
    }
  }

  return {
    description,
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

function isProductNavigationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return normalizeProductHost(parsed.href) !== null;
  } catch {
    return false;
  }
}

/** Test helper: extract navigation URLs from YouTube HTML (Shorts link cards, etc.) */
export function extractYouTubeNavigationUrls(html: string): string[] {
  const urls = new Set<string>();

  const urlEndpointRe = /"urlEndpoint"\s*:\s*\{\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(urlEndpointRe)) {
    if (match[1]) {
      const decoded = decodeJsonString(match[1]);
      if (isProductNavigationUrl(decoded)) urls.add(decoded);
    }
  }

  const commandUrlRe = /"commandMetadata"\s*:\s*\{[^}]*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(commandUrlRe)) {
    if (match[1]) {
      const decoded = decodeJsonString(match[1]);
      if (isProductNavigationUrl(decoded)) urls.add(decoded);
    }
  }

  const webCommandRe = /"webCommandMetadata"\s*:\s*\{[^}]*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(webCommandRe)) {
    if (match[1]) {
      const decoded = decodeJsonString(match[1]);
      if (isProductNavigationUrl(decoded)) urls.add(decoded);
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

/** Token required by X's syndication endpoint (used by tweet embeds). */
export function xSyndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

export function tweetHasVideo(data: Record<string, unknown>): boolean {
  const mediaDetails = data.mediaDetails as Array<Record<string, unknown>> | undefined;
  if (mediaDetails?.some((item) => item.type === "video" || item.type === "animated_gif")) {
    return true;
  }

  const photos = data.photos as Array<Record<string, unknown>> | undefined;
  if (photos?.some((item) => item.type === "video" || item.type === "animated_gif")) {
    return true;
  }

  const video = data.video as Record<string, unknown> | undefined;
  if (video?.variants || video?.video_info || video?.poster) return true;

  const entities = data.entities as Record<string, unknown> | undefined;
  const media = entities?.media as Array<Record<string, unknown>> | undefined;
  if (media?.some((item) => item.type === "video" || item.type === "animated_gif")) {
    return true;
  }

  return false;
}

export function fxTwitterHasVideo(tweet: Record<string, unknown>): boolean {
  const media = tweet.media as Record<string, unknown> | undefined;
  const all = media?.all as Array<Record<string, unknown>> | undefined;
  if (all?.some((item) => item.type === "video" || item.type === "animated_gif")) {
    return true;
  }

  const videos = media?.videos as unknown[] | undefined;
  return Boolean(videos?.length);
}

interface XParsedMetadata {
  description: string;
  title: string;
  thumbnail: string | null;
  author: string | null;
  authorUrl: string | null;
  platformAccount: string | null;
  publishedAt: string | null;
}

const X_MEDIA_HOSTS = new Set(["pic.x.com", "pic.twitter.com", "x.com", "twitter.com", "mobile.x.com", "mobile.twitter.com"]);

/** Skip expanded t.co targets that point at tweet media or X permalinks, not products. */
export function isXMediaExpandedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "pic.x.com" || host === "pic.twitter.com") return true;
    if (X_MEDIA_HOSTS.has(host) && /\/(video|photo)\/\d+/.test(parsed.pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

/** Expand t.co links in syndication tweet text using entities.urls expanded_url. */
export function expandXSyndicationText(data: Record<string, unknown>): string {
  const text = typeof data.text === "string" ? data.text : "";
  const entities = data.entities as Record<string, unknown> | undefined;
  const urls = entities?.urls as Array<Record<string, unknown>> | undefined;
  if (!urls?.length) return text;

  let expanded = text;
  for (const entry of urls) {
    const shortUrl = typeof entry.url === "string" ? entry.url : null;
    const expandedUrl = typeof entry.expanded_url === "string" ? entry.expanded_url : null;
    if (!shortUrl || !expandedUrl || isXMediaExpandedUrl(expandedUrl)) continue;
    expanded = expanded.split(shortUrl).join(expandedUrl);
  }
  return expanded;
}

function extractProductUrlFromXEntities(raw?: {
  syndication?: Record<string, unknown>;
  fxTweet?: Record<string, unknown>;
}): string | null {
  const candidates: string[] = [];

  const syndicationUrls = (raw?.syndication?.entities as Record<string, unknown> | undefined)?.urls as
    | Array<Record<string, unknown>>
    | undefined;
  for (const entry of syndicationUrls ?? []) {
    const expandedUrl = typeof entry.expanded_url === "string" ? entry.expanded_url : null;
    const displayUrl = typeof entry.display_url === "string" ? entry.display_url : null;
    if (expandedUrl && !isXMediaExpandedUrl(expandedUrl)) {
      candidates.push(expandedUrl);
    } else if (displayUrl) {
      candidates.push(displayUrl);
    }
  }

  const facets = (raw?.fxTweet?.raw_text as Record<string, unknown> | undefined)?.facets as
    | Array<Record<string, unknown>>
    | undefined;
  for (const facet of facets ?? []) {
    if (facet.type !== "url") continue;
    const replacement = typeof facet.replacement === "string" ? facet.replacement : null;
    if (replacement && !isXMediaExpandedUrl(replacement)) {
      candidates.push(replacement);
    }
  }

  for (const candidate of candidates) {
    const fromUrl = extractProductUrl(candidate);
    if (fromUrl) return fromUrl;
    const normalized = normalizeProductUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function parseXSyndicationResponse(data: Record<string, unknown>): XParsedMetadata {
  const text = expandXSyndicationText(data);
  const user = data.user as Record<string, unknown> | undefined;
  const screenName = typeof user?.screen_name === "string" ? user.screen_name : null;
  const displayName = typeof user?.name === "string" ? user.name : null;

  let thumbnail: string | null = null;
  const mediaDetails = data.mediaDetails as Array<Record<string, unknown>> | undefined;
  for (const item of mediaDetails ?? []) {
    if (item.type === "video" || item.type === "animated_gif") {
      thumbnail =
        (typeof item.media_url_https === "string" ? item.media_url_https : null) ??
        (typeof item.url === "string" ? item.url : null);
      if (thumbnail) break;
    }
  }

  const createdAt = typeof data.created_at === "string" ? data.created_at : null;
  const authorUrl = screenName ? `https://x.com/${screenName}` : null;

  return {
    description: text,
    title: displayName ? `${displayName} on X` : "Post on X",
    thumbnail,
    author: screenName ? `@${screenName}` : displayName,
    authorUrl,
    platformAccount: resolvePlatformAccount("x", { authorUrl, author: screenName }),
    publishedAt: createdAt ? normalizePublishedAt(createdAt) : null,
  };
}

export function parseFxTwitterResponse(tweet: Record<string, unknown>): XParsedMetadata {
  const text = typeof tweet.text === "string" ? tweet.text : "";
  const author = tweet.author as Record<string, unknown> | undefined;
  const screenName = typeof author?.screen_name === "string" ? author.screen_name : null;
  const displayName = typeof author?.name === "string" ? author.name : null;

  let thumbnail: string | null = null;
  const media = tweet.media as Record<string, unknown> | undefined;
  const all = media?.all as Array<Record<string, unknown>> | undefined;
  for (const item of all ?? []) {
    if (item.type === "video" || item.type === "animated_gif") {
      thumbnail = typeof item.thumbnail_url === "string" ? item.thumbnail_url : null;
      if (thumbnail) break;
    }
  }

  const createdAt = typeof tweet.created_at === "string" ? tweet.created_at : null;
  const authorUrl = screenName ? `https://x.com/${screenName}` : null;

  return {
    description: text,
    title: displayName ? `${displayName} on X` : "Post on X",
    thumbnail,
    author: screenName ? `@${screenName}` : displayName,
    authorUrl,
    platformAccount: resolvePlatformAccount("x", { authorUrl, author: screenName }),
    publishedAt: createdAt ? normalizePublishedAt(createdAt) : null,
  };
}

export function oembedHtmlHasVideo(html: string): boolean {
  return /video\.twimg\.com|pbs\.twimg\.com\/amplify_video|media-type=["']video|data-media-type=["']video|tweet-video/i.test(
    html,
  );
}

export function parseXOembedHtml(html: string): { description: string; hasVideo: boolean } {
  const hasVideo = oembedHtmlHasVideo(html);
  const paragraphMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const textParts = paragraphMatches
    .map((match) => decodeHtmlEntities(match[1]?.replace(/<[^>]+>/g, "") ?? "").trim())
    .filter(Boolean);

  return {
    description: textParts.join("\n"),
    hasVideo,
  };
}

function isXJsonResponseBlocked(response: Response, body: string): boolean {
  if (!response.ok && (isHttpBlocked(response.status) || response.status >= 500)) return true;
  const trimmed = body.trim();
  if (!trimmed || trimmed === "{}") return true;
  if (trimmed.startsWith("<")) return true;
  return false;
}

async function fetchXJsonWithRetry(
  url: string,
  bindings: VideoFetchBindings,
): Promise<Record<string, unknown> | null> {
  const requestInit: RequestInit = {
    headers: { Accept: "application/json", "User-Agent": CHROME_USER_AGENT },
  };

  try {
    let { response: res, layer } = await proxiedFetch(url, bindings, { init: requestInit });
    let body = await res.text();

    if (isXJsonResponseBlocked(res, body) && layer === "direct") {
      const retry = await proxiedFetch(url, bindings, { forceProxy: true, init: requestInit });
      res = retry.response;
      body = await res.text();
    }

    if (isXJsonResponseBlocked(res, body)) return null;

    const data = JSON.parse(body) as Record<string, unknown>;
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function buildXVideoMetadata(
  videoId: string,
  normalizedUrl: string,
  parsed: XParsedMetadata,
  productUrl: string | null,
): VideoMetadata {
  if (!parsed.description.trim()) {
    throw new Error(X_EMPTY_MESSAGE);
  }

  return {
    platform: "x",
    videoId,
    normalizedUrl,
    title: parsed.title,
    description: parsed.description,
    thumbnail: parsed.thumbnail,
    author: parsed.author,
    authorUrl: parsed.authorUrl,
    platformAccount: parsed.platformAccount,
    publishedAt: parsed.publishedAt,
    productUrl,
  };
}

/** Test helper: ordered @handles from syndication entities.user_mentions. */
export function extractXMentionsFromSyndication(data: Record<string, unknown>): string[] {
  const entities = data.entities as Record<string, unknown> | undefined;
  const mentions = entities?.user_mentions as Array<Record<string, unknown>> | undefined;
  const handles: string[] = [];
  for (const mention of mentions ?? []) {
    const screenName = typeof mention.screen_name === "string" ? mention.screen_name : null;
    if (screenName) handles.push(screenName);
  }
  return handles;
}

/** Test helper: ordered @handles from fxtwitter raw_text facets or tweet text. */
export function extractXMentionsFromFxTwitter(tweet: Record<string, unknown>): string[] {
  const rawText = tweet.raw_text as Record<string, unknown> | undefined;
  const facets = rawText?.facets as Array<Record<string, unknown>> | undefined;
  if (facets?.length) {
    const handles: string[] = [];
    for (const facet of facets) {
      if (facet.type !== "mention") continue;
      const original = typeof facet.original === "string" ? facet.original : null;
      if (original) handles.push(original.replace(/^@/, ""));
    }
    if (handles.length) return handles;
  }

  const text = typeof tweet.text === "string" ? tweet.text : "";
  const handles: string[] = [];
  for (const match of text.matchAll(/@([A-Za-z0-9_]{1,15})/g)) {
    if (match[1]) handles.push(match[1]);
  }
  return handles;
}

async function fetchFxTwitterUserWebsite(
  handle: string,
  bindings: VideoFetchBindings,
): Promise<string | null> {
  const url = `https://api.fxtwitter.com/${encodeURIComponent(handle)}`;
  const data = await fetchXJsonWithRetry(url, bindings);
  if (!data || data.code !== 200) return null;

  const user = data.user as Record<string, unknown> | undefined;
  const website = user?.website as Record<string, unknown> | undefined;
  const websiteUrl = typeof website?.url === "string" ? website.url : null;
  if (!websiteUrl) return null;

  return normalizeProductUrl(websiteUrl);
}

/** Resolve product URL from tweet text, then tagged business mentions (skips author). */
export async function resolveXProductUrl(
  description: string,
  authorHandle: string | null,
  bindings: VideoFetchBindings,
  raw?: { syndication?: Record<string, unknown>; fxTweet?: Record<string, unknown> },
): Promise<string | null> {
  const fromText = extractProductUrl(description);
  if (fromText) return fromText;

  const fromEntities = extractProductUrlFromXEntities(raw);
  if (fromEntities) return fromEntities;

  const mentions =
    raw?.syndication != null
      ? extractXMentionsFromSyndication(raw.syndication)
      : raw?.fxTweet != null
        ? extractXMentionsFromFxTwitter(raw.fxTweet)
        : [];

  const authorLower = authorHandle?.replace(/^@/, "").toLowerCase() ?? null;
  for (const handle of mentions) {
    if (handle.toLowerCase() === authorLower) continue;
    const productUrl = await fetchFxTwitterUserWebsite(handle, bindings);
    if (productUrl) return productUrl;
  }

  return null;
}

function authorHandleFromSyndication(data: Record<string, unknown>): string | null {
  const user = data.user as Record<string, unknown> | undefined;
  return typeof user?.screen_name === "string" ? user.screen_name : null;
}

function authorHandleFromFxTweet(tweet: Record<string, unknown>): string | null {
  const author = tweet.author as Record<string, unknown> | undefined;
  return typeof author?.screen_name === "string" ? author.screen_name : null;
}

async function fetchXSyndication(
  tweetId: string,
  bindings: VideoFetchBindings,
): Promise<Record<string, unknown> | null> {
  const token = xSyndicationToken(tweetId);
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}&lang=en&token=${encodeURIComponent(token)}`;
  const data = await fetchXJsonWithRetry(url, bindings);
  if (!data) return null;
  if (typeof data.text !== "string" && typeof data.id_str !== "string") return null;
  return data;
}

async function fetchFxTwitter(
  tweetId: string,
  bindings: VideoFetchBindings,
): Promise<Record<string, unknown> | null> {
  const url = `https://api.fxtwitter.com/status/${encodeURIComponent(tweetId)}`;
  const data = await fetchXJsonWithRetry(url, bindings);
  if (!data || data.code !== 200) return null;

  const tweet = data.tweet as Record<string, unknown> | undefined;
  if (!tweet || typeof tweet.text !== "string") return null;
  return tweet;
}

async function fetchXOembed(
  tweetUrl: string,
  bindings: VideoFetchBindings,
): Promise<OembedResult & { hasVideo: boolean; responded: boolean }> {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true&hide_thread=true`;
  const requestInit: RequestInit = {
    headers: { Accept: "application/json" },
  };

  try {
    let { response: res, layer } = await proxiedFetch(endpoint, bindings, { init: requestInit });
    if (!res.ok && (isHttpBlocked(res.status) || res.status >= 500) && layer === "direct") {
      const retry = await proxiedFetch(endpoint, bindings, {
        forceProxy: true,
        init: requestInit,
      });
      res = retry.response;
    }
    if (!res.ok) return { hasVideo: false, responded: false };

    const data = (await res.json()) as Record<string, unknown>;
    const html = typeof data.html === "string" ? data.html : "";
    const parsed = parseXOembedHtml(html);

    return {
      ...parseOembedJson(data),
      description: parsed.description || undefined,
      hasVideo: parsed.hasVideo,
      responded: true,
    };
  } catch {
    return { hasVideo: false, responded: false };
  }
}

async function fetchXVideoMetadata(
  videoId: string,
  normalizedUrl: string,
  bindings: VideoFetchBindings,
): Promise<VideoMetadata> {
  const syndication = await fetchXSyndication(videoId, bindings);
  if (syndication) {
    if (!tweetHasVideo(syndication)) {
      throw new Error(X_NO_VIDEO_MESSAGE);
    }
    const parsed = parseXSyndicationResponse(syndication);
    const productUrl = await resolveXProductUrl(parsed.description, authorHandleFromSyndication(syndication), bindings, {
      syndication,
    });
    return buildXVideoMetadata(videoId, normalizedUrl, parsed, productUrl);
  }

  const fxTweet = await fetchFxTwitter(videoId, bindings);
  if (fxTweet) {
    if (!fxTwitterHasVideo(fxTweet)) {
      throw new Error(X_NO_VIDEO_MESSAGE);
    }
    const parsed = parseFxTwitterResponse(fxTweet);
    const productUrl = await resolveXProductUrl(parsed.description, authorHandleFromFxTweet(fxTweet), bindings, {
      fxTweet,
    });
    return buildXVideoMetadata(videoId, normalizedUrl, parsed, productUrl);
  }

  const oembed = await fetchXOembed(normalizedUrl, bindings);
  if (oembed.hasVideo && oembed.description?.trim()) {
    const authorHandle =
      typeof oembed.author === "string" ? oembed.author.replace(/^@/, "") : null;
    const productUrl = await resolveXProductUrl(oembed.description ?? "", authorHandle, bindings);
    return {
      platform: "x",
      videoId,
      normalizedUrl,
      title: oembed.title ?? "Post on X",
      description: oembed.description ?? "",
      thumbnail: oembed.thumbnail ?? null,
      author: oembed.author ?? null,
      authorUrl: oembed.authorUrl ?? null,
      platformAccount: resolvePlatformAccount("x", {
        author: oembed.author ?? null,
        authorUrl: oembed.authorUrl ?? null,
      }),
      publishedAt: null,
      productUrl,
    };
  }

  throw new Error(X_READ_FAILED_MESSAGE);
}
