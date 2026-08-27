import type { VideoPlatform } from "./urls";
import { findRejectedBigTechProductUrl, isRejectedBigTechProductUrl } from "./urls";

export const BIG_TECH_REJECT_MESSAGE =
  "Video Club is for makers. Google (and other Big Tech platform) listings are not accepted.";

const BLOCKED_GOOGLE_EMAIL_DOMAINS = new Set(["google.com"]);

/** Official Google YouTube handles — matched case-insensitively on the part after @. */
const BLOCKED_GOOGLE_YOUTUBE_HANDLES = new Set([
  "googledevelopers",
  "google",
  "madebygoogle",
  "googlecloud",
  "androiddevelopers",
  "chrome",
  "googlechrome",
]);

function youtubeHandleFromAccount(account: string): string | null {
  const match = account.toLowerCase().match(/@([^/?#]+)/);
  return match?.[1] ?? null;
}

export function isBlockedFounderEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return domain != null && BLOCKED_GOOGLE_EMAIL_DOMAINS.has(domain);
}

export function isBlockedPlatformAccount(platform: VideoPlatform, account: string | null): boolean {
  if (!account || platform !== "youtube") return false;
  const handle = youtubeHandleFromAccount(account);
  return handle != null && BLOCKED_GOOGLE_YOUTUBE_HANDLES.has(handle);
}

export function getBigTechRejection(input: {
  productUrl?: string | null;
  description?: string | null;
  platform: VideoPlatform;
  platformAccount: string | null;
  email?: string | null;
}): string | null {
  if (input.productUrl && isRejectedBigTechProductUrl(input.productUrl)) {
    return BIG_TECH_REJECT_MESSAGE;
  }

  // No accepted product URL — only then scan description for Google-only listings.
  if (!input.productUrl && input.description && findRejectedBigTechProductUrl(input.description)) {
    return BIG_TECH_REJECT_MESSAGE;
  }

  if (isBlockedPlatformAccount(input.platform, input.platformAccount)) {
    return BIG_TECH_REJECT_MESSAGE;
  }
  if (input.email && isBlockedFounderEmail(input.email)) {
    return BIG_TECH_REJECT_MESSAGE;
  }
  return null;
}
