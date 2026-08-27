import { getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import {
  getChallengeCount,
  getFeedVideos,
  getLeaderboard,
  getLockedPlatformAccount,
  getSiteStats,
  getStartupByHostIncludingRemoved,
  getStartupById,
  getStartupRank,
  getVideoById,
  getVideoByPlatformId,
  getVideosWithChallengeCounts,
  hasChallengedVideo,
  incrementStartupClick,
  incrementVideoPlay,
} from "../db/queries";
import { buildEmailContent, EMAIL_PREVIEW_FIXTURES } from "../lib/email-templates";
import { notifyRankChange, sendEmail } from "../lib/email";
import {
  CHALLENGE_THRESHOLD,
  challengedAsText,
  parseChallengeReason,
  REMOVED_HOST_MESSAGE,
} from "../lib/challenges";
import { rateLimitChallenge, rateLimitSubmit } from "../lib/rate-limit";
import {
  FOREIGN_ACCOUNT_CODE,
  foreignAccountMessage,
  platformLabel,
  REVIEW_INBOX,
} from "../lib/platform-account";
import { getBigTechRejection } from "../lib/submit-validation";
import {
  DUPLICATE_VIDEO_MESSAGE,
  extractProductUrl,
  extractProductUrls,
  hashIp,
  hostToName,
  isValidEmail,
  normalizeProductHost,
  normalizeProductUrl,
} from "../lib/urls";
import { fetchStartupLogo } from "../lib/logo";
import {
  PRESENCE_COOKIE,
  PRESENCE_COOKIE_MAX_AGE,
  recordVisitor,
  resolveVisitorId,
} from "../lib/presence";
import { getPublicVisitorCounts } from "../lib/visitors";
import { fetchVideoMetadata } from "../lib/video";
import type { BoardPeriod, Env, VideoMetadata } from "../types";

export type ProductCandidate = {
  host: string;
  product_url: string;
  isNew: boolean;
};

function gatherProductUrls(metadata: VideoMetadata): string[] {
  const urls = extractProductUrls(metadata.description);
  if (!metadata.productUrl) return urls;

  const host = normalizeProductHost(metadata.productUrl);
  const normalized = normalizeProductUrl(metadata.productUrl);
  if (!host || !normalized) return urls;
  if (urls.some((url) => normalizeProductHost(url) === host)) return urls;
  return [normalized, ...urls];
}

async function resolveProductCandidates(
  db: D1Database,
  metadata: VideoMetadata,
): Promise<{ candidates: ProductCandidate[]; onlyRemoved: boolean }> {
  const candidates: ProductCandidate[] = [];
  const seenHosts = new Set<string>();
  let hadRemoved = false;
  let hadAnyValidUrl = false;

  for (const url of gatherProductUrls(metadata)) {
    const host = normalizeProductHost(url);
    if (!host || seenHosts.has(host)) continue;
    seenHosts.add(host);
    hadAnyValidUrl = true;

    const existing = await getStartupByHostIncludingRemoved(db, host);
    if (existing?.removed_at) {
      hadRemoved = true;
      continue;
    }

    candidates.push({
      host,
      product_url: normalizeProductUrl(url) ?? url,
      isNew: !existing,
    });
  }

  return { candidates, onlyRemoved: hadAnyValidUrl && candidates.length === 0 && hadRemoved };
}

export const api = new Hono<{ Bindings: Env }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function parsePeriod(value: string | undefined): BoardPeriod {
  return value === "today" ? "today" : "all";
}

api.get("/logo/:host", async (c) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(c.req.param("host"));
  } catch {
    return c.json({ error: "Invalid host" }, 400);
  }

  const host = normalizeProductHost(decoded);
  if (!host) return c.json({ error: "Invalid host" }, 400);

  const startup = await getStartupByHostIncludingRemoved(c.env.DB, host);
  if (!startup || startup.removed_at) {
    return c.json({ error: "Invalid host" }, 400);
  }

  const cache = await caches.open("videoclub-logos");
  const cacheKey = new Request(`https://logo.videoclub.internal/${host}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const logo = await fetchStartupLogo(host, c.env);
  const isFallback = logo.contentType.startsWith("image/svg+xml");
  const cacheControl = isFallback
    ? "public, max-age=3600, stale-while-revalidate=600"
    : "public, max-age=604800, stale-while-revalidate=86400";
  const response = new Response(logo.bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": cacheControl,
    },
  });

  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
});

api.get("/visitors", async (c) => {
  const counts = await getPublicVisitorCounts(c.env);
  return c.json(counts);
});

api.post("/visitors", async (c) => {
  const cookieId = getCookie(c, PRESENCE_COOKIE);
  const body = (await c.req.json<{ visitorId?: string }>().catch(
    (): { visitorId?: string } => ({}),
  )) as { visitorId?: string };
  const visitorId = resolveVisitorId(cookieId, body.visitorId);
  await recordVisitor(c.env.DB, visitorId);
  const counts = await getPublicVisitorCounts(c.env);

  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, PRESENCE_COOKIE, visitorId, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: PRESENCE_COOKIE_MAX_AGE,
  });

  return c.json(counts);
});

api.get("/leaderboard", async (c) => {
  const period = parsePeriod(c.req.query("period"));
  const [entries, stats] = await Promise.all([
    getLeaderboard(c.env.DB, period),
    getSiteStats(c.env.DB),
  ]);
  return c.json({ period, entries, ...stats });
});

api.get("/feed", async (c) => {
  const limitRaw = Number(c.req.query("limit"));
  const pageLimit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
  const cursorRaw = c.req.query("cursor") ?? c.req.query("before");
  const cursor = cursorRaw ? Number(cursorRaw) : undefined;

  const videos = await getFeedVideos(c.env.DB, {
    limit: pageLimit,
    cursor: cursor && Number.isFinite(cursor) ? cursor : undefined,
  });

  const stats = await getSiteStats(c.env.DB);

  const nextCursor =
    videos.length === pageLimit && videos.length > 0 ? String(videos[videos.length - 1]!.id) : null;

  return c.json({
    videos: videos.map((v) => ({
      id: v.id,
      platform: v.platform,
      video_id: v.video_id,
      video_url: v.video_url,
      title: v.title,
      thumbnail: v.thumbnail,
      author: v.author,
      published_at: v.published_at,
      created_at: v.created_at,
      submitted_at: v.created_at,
      product_url: v.product_url,
      play_count: v.play_count,
      startup: {
        id: v.startup_id,
        name: v.startup_name,
        product_host: v.startup_host,
        rank: v.startup_rank,
        click_count: v.startup_click_count,
        play_count: v.startup_play_count,
      },
      challenge_count: v.challenge_count,
    })),
    nextCursor,
    ...stats,
  });
});

api.get("/dev/email-previews", (c) => {
  const previews = EMAIL_PREVIEW_FIXTURES.map((fixture) => {
    const content = buildEmailContent(fixture.payload, c.env.APP_URL);
    return { id: fixture.id, kind: fixture.payload.kind, ...content };
  });
  return c.json({ previews });
});

api.get("/startups/:id/videos", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid startup id" }, 400);

  const startup = await getStartupById(c.env.DB, id);
  if (!startup || startup.removed_at) {
    return c.json({ error: "Startup not found" }, 404);
  }

  const videos = await getVideosWithChallengeCounts(c.env.DB, id);
  return c.json({
    startup: {
      id: startup.id,
      name: startup.name,
      product_url: startup.product_url,
      product_host: startup.product_host,
      click_count: startup.click_count,
      play_count: startup.play_count,
    },
    videos: videos.map((v) => ({
      id: v.id,
      video_url: v.video_url,
      platform: v.platform,
      title: v.title,
      thumbnail: v.thumbnail,
      published_at: v.published_at,
      submitted_at: v.created_at,
      challenge_count: v.challenge_count,
      play_count: v.play_count,
    })),
  });
});

api.post("/startups/:id/click", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid startup id" }, 400);

  const result = await incrementStartupClick(c.env.DB, id);
  if (!result) return c.json({ error: "Startup not found" }, 404);

  const stats = await getSiteStats(c.env.DB);
  return c.json({ ok: true, click_count: result.click_count, ...stats });
});

api.post("/videos/:id/play", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid video id" }, 400);

  const result = await incrementVideoPlay(c.env.DB, id);
  if (!result) return c.json({ error: "Video not found" }, 404);

  const stats = await getSiteStats(c.env.DB);
  return c.json({
    ok: true,
    play_count: result.play_count,
    startup_play_count: result.startup_play_count,
    ...stats,
  });
});

api.post("/check", async (c) => {
  const body = await c.req.json<{ videoUrl?: string }>().catch(() => ({ videoUrl: undefined }));
  const videoUrl = body.videoUrl?.trim();
  if (!videoUrl) return c.json({ error: "Video URL is required" }, 400);

  try {
    const metadata = await fetchVideoMetadata(videoUrl, c.env);

    const existingVideo = await getVideoByPlatformId(c.env.DB, metadata.platform, metadata.videoId);
    if (existingVideo) {
      return c.json({
        emailRequired: false,
        productFound: false,
        duplicate: true,
        error: DUPLICATE_VIDEO_MESSAGE,
      });
    }

    const { candidates, onlyRemoved } = await resolveProductCandidates(c.env.DB, metadata);

    const bigTechRejection = getBigTechRejection({
      productUrl: candidates[0]?.product_url ?? metadata.productUrl ?? extractProductUrl(metadata.description),
      description: metadata.description,
      platform: metadata.platform,
      platformAccount: metadata.platformAccount,
    });
    if (bigTechRejection) {
      return c.json({ emailRequired: false, productFound: false, error: bigTechRejection });
    }

    if (onlyRemoved) {
      return c.json({ emailRequired: false, productFound: false, error: REMOVED_HOST_MESSAGE });
    }

    if (candidates.length === 0) {
      return c.json({
        emailRequired: false,
        productFound: false,
        error:
          "No product link found in the video description. Add your startup URL (not YouTube/TikTok/Instagram/X).",
      });
    }

    const defaultCandidate = candidates[0]!;
    const emailRequired = defaultCandidate.isNew;

    return c.json({
      emailRequired,
      productFound: true,
      candidates,
      productUrl: defaultCandidate.product_url,
      productHost: defaultCandidate.host,
      startupName: hostToName(defaultCandidate.host),
      publishedAt: metadata.publishedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read video";
    return c.json({ emailRequired: false, productFound: false, error: message });
  }
});

api.post("/submit", async (c) => {
  const ipHash = await hashIp(clientIp(c));
  const limited = await rateLimitSubmit(c.env.DB, ipHash);
  if (!limited.allowed) {
    return c.json(
      { error: `Too many submissions. Try again in ${limited.retryAfterSeconds ?? 3600} seconds.` },
      429,
    );
  }

  const body = await c.req
    .json<{ videoUrl?: string; email?: string; force?: boolean; productHost?: string }>()
    .catch(() => ({ videoUrl: undefined, email: undefined, force: undefined, productHost: undefined }));

  const videoUrl = body.videoUrl?.trim();
  const email = body.email?.trim().toLowerCase();
  const force = body.force === true;
  const requestedHost = body.productHost?.trim().toLowerCase();

  if (!videoUrl) return c.json({ error: "Video URL is required" }, 400);

  let metadata;
  try {
    metadata = await fetchVideoMetadata(videoUrl, c.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read video";
    return c.json({ error: message }, 400);
  }

  const existingVideo = await getVideoByPlatformId(c.env.DB, metadata.platform, metadata.videoId);
  if (existingVideo) {
    return c.json({ error: DUPLICATE_VIDEO_MESSAGE }, 409);
  }

  const { candidates, onlyRemoved } = await resolveProductCandidates(c.env.DB, metadata);

  const bigTechRejection = getBigTechRejection({
    productUrl: candidates[0]?.product_url ?? metadata.productUrl ?? extractProductUrl(metadata.description),
    description: metadata.description,
    platform: metadata.platform,
    platformAccount: metadata.platformAccount,
    email,
  });
  if (bigTechRejection) {
    return c.json({ error: bigTechRejection }, 403);
  }

  if (onlyRemoved) {
    return c.json({ error: REMOVED_HOST_MESSAGE }, 403);
  }

  if (candidates.length === 0) {
    return c.json(
      {
        error:
          "No product link in the video description. Add your startup URL (http/https, not YouTube/TikTok/Instagram/X).",
      },
      400,
    );
  }

  const chosen = requestedHost
    ? candidates.find((candidate) => candidate.host === requestedHost)
    : candidates[0];

  if (requestedHost && !chosen) {
    return c.json({ error: "That product domain is not in this video's description." }, 400);
  }

  if (!chosen) {
    return c.json({ error: "No product link in the video description." }, 400);
  }

  const productHost = chosen.host;
  const normalizedProductUrl = chosen.product_url;
  const startup = await getStartupByHostIncludingRemoved(c.env.DB, productHost);

  if (startup?.removed_at) {
    return c.json({ error: REMOVED_HOST_MESSAGE }, 403);
  }

  const isNewStartup = chosen.isNew;

  if (isNewStartup) {
    if (!email || !isValidEmail(email)) {
      return c.json(
        { error: "Email is required the first time your startup is added.", emailRequired: true },
        400,
      );
    }
  }

  if (!isNewStartup) {
    const lockedAccount = await getLockedPlatformAccount(c.env.DB, startup!.id, metadata.platform);
    const submittedAccount = metadata.platformAccount;

    if (lockedAccount && submittedAccount && lockedAccount !== submittedAccount) {
      if (!force) {
        return c.json(
          {
            error: foreignAccountMessage(metadata.platform),
            code: FOREIGN_ACCOUNT_CODE,
            platform: metadata.platform,
            lockedAccount,
            submittedAccount,
          },
          409,
        );
      }
    }
  }

  const now = new Date().toISOString();
  let startupId: number;
  const lockedBeforeInsert = !isNewStartup
    ? await getLockedPlatformAccount(c.env.DB, startup!.id, metadata.platform)
    : null;
  const needsReview =
    !isNewStartup &&
    force &&
    lockedBeforeInsert != null &&
    metadata.platformAccount != null &&
    lockedBeforeInsert !== metadata.platformAccount;

  if (isNewStartup) {
    const insert = await c.env.DB.prepare(
      `INSERT INTO startups (product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
      .bind(normalizedProductUrl, productHost, hostToName(productHost), email!, now)
      .run();
    startupId = Number(insert.meta.last_row_id);
  } else {
    startupId = startup!.id;
  }

  await c.env.DB.prepare(
    `INSERT INTO videos
      (startup_id, video_url, video_id, platform, title, description, thumbnail, author, platform_account, product_url_found, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      startupId,
      metadata.normalizedUrl,
      metadata.videoId,
      metadata.platform,
      metadata.title,
      metadata.description,
      metadata.thumbnail,
      metadata.author,
      metadata.platformAccount,
      normalizedProductUrl,
      metadata.publishedAt,
      now,
    )
    .run();

  const rank = (await getStartupRank(c.env.DB, startupId, "all")) ?? 1;
  const freshStartup = await getStartupById(c.env.DB, startupId);

  c.executionCtx.waitUntil(
    (async () => {
      if (!freshStartup) return;

      if (needsReview) {
        await sendEmail(c.env, {
          kind: "foreign_account_review",
          to: REVIEW_INBOX,
          startupName: freshStartup.name,
          productUrl: freshStartup.product_url,
          productHost,
          platform: platformLabel(metadata.platform),
          lockedAccount: lockedBeforeInsert ?? "unknown",
          submittedAccount: metadata.platformAccount ?? "unknown",
          videoUrl: metadata.normalizedUrl,
          videoTitle: metadata.title,
          submitterEmail: email ?? freshStartup.email,
          submittedAt: now,
        });
      }

      if (isNewStartup) {
        await sendEmail(c.env, {
          kind: "welcome",
          to: freshStartup.email,
          startupName: freshStartup.name,
          productUrl: freshStartup.product_url,
          rank,
        });
        await c.env.DB
          .prepare("UPDATE startups SET last_notified_rank = ? WHERE id = ?")
          .bind(rank, startupId)
          .run();
      } else {
        await notifyRankChange(c.env, c.env.DB, freshStartup, rank);
      }

      const board = await getLeaderboard(c.env.DB, "all");
      for (const entry of board) {
        if (entry.id === startupId) continue;
        const other = await getStartupById(c.env.DB, entry.id);
        if (other) await notifyRankChange(c.env, c.env.DB, other, entry.rank);
      }
    })(),
  );

  return c.json({
    ok: true,
    startup: {
      id: startupId,
      name: freshStartup?.name ?? hostToName(productHost),
      product_url: normalizedProductUrl,
      rank,
    },
    video: {
      title: metadata.title,
      platform: metadata.platform,
      url: metadata.normalizedUrl,
      publishedAt: metadata.publishedAt,
    },
  });
});

api.post("/challenge/:videoId", async (c) => {
  const ipHash = await hashIp(clientIp(c));
  const limited = await rateLimitChallenge(c.env.DB, ipHash);
  if (!limited.allowed) {
    return c.json(
      { error: `Too many challenges. Try again in ${limited.retryAfterSeconds ?? 3600} seconds.` },
      429,
    );
  }

  const videoId = Number(c.req.param("videoId"));
  if (!Number.isFinite(videoId)) return c.json({ error: "Invalid video id" }, 400);

  const body = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  const reason = parseChallengeReason(body.reason);
  if (!reason) {
    return c.json({ error: "Invalid challenge reason." }, 400);
  }

  const video = await getVideoById(c.env.DB, videoId);
  if (!video || video.removed_at) {
    return c.json({ error: "Video not found" }, 404);
  }

  const startup = await getStartupById(c.env.DB, video.startup_id);
  if (!startup || startup.removed_at) {
    return c.json({ error: "Startup not found" }, 404);
  }

  if (await hasChallengedVideo(c.env.DB, videoId, ipHash)) {
    return c.json({ error: "You already challenged this video." }, 409);
  }

  const now = new Date().toISOString();
  try {
    await c.env.DB.prepare(
      "INSERT INTO challenges (video_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(videoId, reason, ipHash, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint")) {
      return c.json({ error: "You already challenged this video." }, 409);
    }
    console.error("[challenge] insert failed", err);
    return c.json({ error: "Failed to record challenge." }, 500);
  }

  const challengeCount = await getChallengeCount(c.env.DB, videoId);
  const reachedThreshold = challengeCount >= CHALLENGE_THRESHOLD;

  if (reachedThreshold) {
    const removalReason = `Removed after ${challengeCount} community challenges`;
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE videos SET removed_at = ? WHERE startup_id = ?").bind(now, startup.id),
      c.env.DB.prepare(
        "UPDATE startups SET removed_at = ?, removal_reason = ? WHERE id = ?",
      ).bind(now, removalReason, startup.id),
    ]);

    c.executionCtx.waitUntil(
      (async () => {
        await sendEmail(c.env, {
          kind: "removed",
          to: startup.email,
          startupName: startup.name,
          productUrl: startup.product_url,
          videoUrl: video.video_url,
          videoTitle: video.title,
          removalReason,
          challengeCount,
        });

        const board = await getLeaderboard(c.env.DB, "all");
        for (const entry of board) {
          const other = await getStartupById(c.env.DB, entry.id);
          if (other) await notifyRankChange(c.env, c.env.DB, other, entry.rank);
        }
      })(),
    );
  } else if (challengeCount === 1 || challengeCount === 2) {
    c.executionCtx.waitUntil(
      sendEmail(c.env, {
        kind: "challenged",
        to: startup.email,
        startupName: startup.name,
        productUrl: startup.product_url,
        videoUrl: video.video_url,
        videoTitle: video.title,
        challengeReason: challengedAsText(reason),
        challengeCount,
      }),
    );
  }

  return c.json({
    ok: true,
    challengeCount,
    removed: reachedThreshold,
    message: reachedThreshold
      ? "Three challenges reached. Startup removed from the board."
      : `Challenge recorded (${challengeCount}/${CHALLENGE_THRESHOLD}).`,
  });
});
