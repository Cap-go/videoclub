import { Hono } from "hono";
import {
  getChallengeCount,
  getFeedVideos,
  getLeaderboard,
  getLockedPlatformAccount,
  getStartupByHostIncludingRemoved,
  getStartupById,
  getStartupRank,
  getVideoById,
  getVideoByPlatformId,
  getVideosWithChallengeCounts,
  hasChallengedVideo,
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
import {
  DUPLICATE_VIDEO_MESSAGE,
  extractProductUrl,
  hashIp,
  hostToName,
  isValidEmail,
  normalizeProductHost,
  normalizeProductUrl,
} from "../lib/urls";
import { fetchVideoMetadata } from "../lib/video";
import type { BoardPeriod, Env } from "../types";

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

api.get("/leaderboard", async (c) => {
  const period = parsePeriod(c.req.query("period"));
  const entries = await getLeaderboard(c.env.DB, period);
  return c.json({ period, entries });
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
      startup: {
        id: v.startup_id,
        name: v.startup_name,
        product_host: v.startup_host,
        rank: v.startup_rank,
      },
      challenge_count: v.challenge_count,
    })),
    nextCursor,
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
    })),
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

    const productUrl = extractProductUrl(metadata.description);
    if (!productUrl) {
      return c.json({
        emailRequired: false,
        productFound: false,
        error: "No product link found in the video description. Add your startup URL (not YouTube/TikTok/Instagram/X).",
      });
    }

    const productHost = normalizeProductHost(productUrl);
    if (!productHost) {
      return c.json({ emailRequired: false, productFound: false, error: "Invalid product URL in description." });
    }

    const existing = await getStartupByHostIncludingRemoved(c.env.DB, productHost);
    if (existing?.removed_at) {
      return c.json({ emailRequired: false, productFound: false, error: REMOVED_HOST_MESSAGE });
    }

    const emailRequired = !existing;

    return c.json({
      emailRequired,
      productFound: true,
      productUrl,
      productHost,
      startupName: hostToName(productHost),
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
    .json<{ videoUrl?: string; email?: string; force?: boolean }>()
    .catch(() => ({ videoUrl: undefined, email: undefined, force: undefined }));

  const videoUrl = body.videoUrl?.trim();
  const email = body.email?.trim().toLowerCase();
  const force = body.force === true;

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

  const productUrlFound = extractProductUrl(metadata.description);
  if (!productUrlFound) {
    return c.json(
      {
        error:
          "No product link in the video description. Add your startup URL (http/https, not YouTube/TikTok/Instagram/X).",
      },
      400,
    );
  }

  const productHost = normalizeProductHost(productUrlFound);
  if (!productHost) {
    return c.json({ error: "Invalid product URL in description." }, 400);
  }

  const normalizedProductUrl = normalizeProductUrl(productUrlFound) ?? productUrlFound;
  const startup = await getStartupByHostIncludingRemoved(c.env.DB, productHost);

  if (startup?.removed_at) {
    return c.json({ error: REMOVED_HOST_MESSAGE }, 403);
  }

  const isNewStartup = !startup;

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
  } else if (challengeCount === 1) {
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
