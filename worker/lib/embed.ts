import type { VideoPlatform } from "./urls";

export type EmbedMode = "iframe" | "fallback";

export interface EmbedInfo {
  mode: EmbedMode;
  embedUrl: string | null;
  watchUrl: string;
}

function instagramKind(videoUrl?: string): "p" | "reel" {
  if (videoUrl?.includes("/p/") || videoUrl?.includes("/tv/")) return "p";
  return "reel";
}

const DEFAULT_SITE_ORIGIN = "https://videoclub.lol";

/** YouTube poster image (hqdefault fallback when no stored thumbnail). */
export function youtubePosterUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Official YouTube embed URL; pass site origin so the player trusts the parent frame. */
export function youtubeEmbedUrl(videoId: string, origin = DEFAULT_SITE_ORIGIN): string {
  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    origin,
  });
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

/** Build YouTube, TikTok, Instagram, or X embed URLs for the public feed. */
export function buildEmbedInfo(
  platform: VideoPlatform | string,
  videoId: string,
  videoUrl?: string,
): EmbedInfo {
  const watchUrl = videoUrl ?? "#";

  if (platform === "youtube" && videoId) {
    return {
      mode: "iframe",
      embedUrl: youtubeEmbedUrl(videoId),
      watchUrl: videoUrl ?? `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (platform === "tiktok" && videoId) {
    return {
      mode: "iframe",
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      watchUrl: videoUrl ?? `https://www.tiktok.com/video/${videoId}`,
    };
  }

  if (platform === "instagram" && videoId) {
    const kind = instagramKind(videoUrl);
    return {
      mode: "fallback",
      embedUrl: `https://www.instagram.com/${kind}/${videoId}/embed`,
      watchUrl: videoUrl ?? `https://www.instagram.com/${kind}/${videoId}/`,
    };
  }

  if (platform === "x" && videoId) {
    return {
      mode: "iframe",
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${videoId}&dnt=true`,
      watchUrl: videoUrl ?? `https://x.com/i/status/${videoId}`,
    };
  }

  return {
    mode: "fallback",
    embedUrl: null,
    watchUrl,
  };
}
