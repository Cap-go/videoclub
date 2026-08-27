import type { VideoPlatform } from "./urls";

export const REVIEW_INBOX = "martin@capgo.app";
export const FOREIGN_ACCOUNT_CODE = "FOREIGN_ACCOUNT";

export function normalizePlatformAccount(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

export interface PlatformAccountInput {
  author?: string | null;
  authorUrl?: string | null;
}

/** Stable identity for a video's posting account on a platform. */
export function resolvePlatformAccount(
  platform: VideoPlatform,
  input: PlatformAccountInput,
): string | null {
  const authorUrl = input.authorUrl?.trim();
  if (authorUrl) return normalizePlatformAccount(authorUrl);

  const author = input.author?.trim();
  if (!author) return null;

  if (platform === "youtube") {
    if (author.startsWith("@")) {
      return normalizePlatformAccount(`https://www.youtube.com/${author}`);
    }
    return normalizePlatformAccount(`youtube:${author}`);
  }

  if (platform === "tiktok") {
    const handle = author.startsWith("@") ? author : `@${author}`;
    return normalizePlatformAccount(`tiktok:${handle}`);
  }

  const handle = author.startsWith("@") ? author : `@${author}`;
  return normalizePlatformAccount(`instagram:${handle}`);
}

export function platformLabel(platform: VideoPlatform): string {
  if (platform === "youtube") return "YouTube";
  if (platform === "tiktok") return "TikTok";
  return "Instagram";
}

export function foreignAccountMessage(platform: VideoPlatform): string {
  const label = platformLabel(platform);
  return `This domain is already posting from another ${label} account. We don't allow other people to post for a startup. If these are both your accounts, you can force it — we'll email the team to review.`;
}
