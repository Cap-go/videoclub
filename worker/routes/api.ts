import { Hono } from "hono";
import {
  getLeaderboard,
  getStartupByHostIncludingRemoved,
  getStartupById,
  getStartupRank,
  getVideoById,
  getVideosForStartup,
} from "../db/queries";
import { notifyRankChange, sendEmail } from "../lib/email";
import { rateLimitReport, rateLimitSubmit } from "../lib/rate-limit";
import {
  extractProductUrl,
  hashIp,
  hostToName,
  isValidEmail,
  normalizeProductHost,
  normalizeProductUrl,
} from "../lib/urls";
import { fetchVideoMetadata } from "../lib/video";
import type { Env } from "../types";

export const api = new Hono<{ Bindings: Env }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

api.get("/leaderboard", async (c) => {
  const entries = await getLeaderboard(c.env.DB);
  return c.json({ entries });
});

api.get("/startups/:id/videos", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid startup id" }, 400);

  const startup = await getStartupById(c.env.DB, id);
  if (!startup || startup.removed_at) {
    return c.json({ error: "Startup not found" }, 404);
  }

  const videos = await getVideosForStartup(c.env.DB, id);
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
      created_at: v.created_at,
    })),
  });
});

api.post("/check", async (c) => {
  const body = await c.req.json<{ videoUrl?: string }>().catch(() => ({ videoUrl: undefined }));
  const videoUrl = body.videoUrl?.trim();
  if (!videoUrl) return c.json({ error: "Video URL is required" }, 400);

  try {
    const metadata = await fetchVideoMetadata(videoUrl);
    const productUrl = extractProductUrl(metadata.description);
    if (!productUrl) {
      return c.json({
        emailRequired: false,
        productFound: false,
        error: "No product link found in the video description. Add your startup URL (not YouTube/TikTok/Instagram).",
      });
    }

    const productHost = normalizeProductHost(productUrl);
    if (!productHost) {
      return c.json({ emailRequired: false, productFound: false, error: "Invalid product URL in description." });
    }

    const existing = await getStartupByHostIncludingRemoved(c.env.DB, productHost);
    const emailRequired = !existing || !!existing.removed_at;

    return c.json({
      emailRequired,
      productFound: true,
      productUrl,
      productHost,
      startupName: hostToName(productHost),
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
    .json<{ videoUrl?: string; email?: string }>()
    .catch(() => ({ videoUrl: undefined, email: undefined }));

  const videoUrl = body.videoUrl?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!videoUrl) return c.json({ error: "Video URL is required" }, 400);

  let metadata;
  try {
    metadata = await fetchVideoMetadata(videoUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read video";
    return c.json({ error: message }, 400);
  }

  const existingVideo = await c.env.DB
    .prepare("SELECT id, removed_at FROM videos WHERE video_url = ?")
    .bind(metadata.normalizedUrl)
    .first<{ id: number; removed_at: string | null }>();

  if (existingVideo && !existingVideo.removed_at) {
    return c.json({ error: "This video has already been submitted." }, 409);
  }

  const productUrlFound = extractProductUrl(metadata.description);
  if (!productUrlFound) {
    return c.json(
      {
        error:
          "No product link in the video description. Add your startup URL (http/https, not YouTube/TikTok/Instagram).",
      },
      400,
    );
  }

  const productHost = normalizeProductHost(productUrlFound);
  if (!productHost) {
    return c.json({ error: "Invalid product URL in description." }, 400);
  }

  const normalizedProductUrl = normalizeProductUrl(productUrlFound) ?? productUrlFound;
  let startup = await getStartupByHostIncludingRemoved(c.env.DB, productHost);
  const isNewStartup = !startup || !!startup.removed_at;

  if (isNewStartup) {
    if (!email || !isValidEmail(email)) {
      return c.json(
        { error: "Email is required the first time your startup is added.", emailRequired: true },
        400,
      );
    }
  }

  const now = new Date().toISOString();
  let startupId: number;

  if (isNewStartup) {
    if (startup?.removed_at) {
      await c.env.DB.prepare(
        `UPDATE startups SET
          product_url = ?, name = ?, email = ?, created_at = ?, removed_at = NULL,
          removal_reason = NULL, last_notified_rank = NULL
         WHERE id = ?`,
      )
        .bind(normalizedProductUrl, hostToName(productHost), email!, now, startup.id)
        .run();
      startupId = startup.id;
      startup = await getStartupById(c.env.DB, startupId);
    } else {
      const insert = await c.env.DB.prepare(
        `INSERT INTO startups (product_url, product_host, name, email, created_at, last_notified_rank)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
        .bind(normalizedProductUrl, productHost, hostToName(productHost), email!, now)
        .run();
      startupId = Number(insert.meta.last_row_id);
      startup = await getStartupById(c.env.DB, startupId);
    }
  } else {
    startupId = startup!.id;
  }

  if (existingVideo?.removed_at) {
    await c.env.DB.prepare(
      `UPDATE videos SET
        startup_id = ?, platform = ?, title = ?, description = ?, thumbnail = ?, author = ?,
        product_url_found = ?, created_at = ?, removed_at = NULL
       WHERE id = ?`,
    )
      .bind(
        startupId,
        metadata.platform,
        metadata.title,
        metadata.description,
        metadata.thumbnail,
        metadata.author,
        normalizedProductUrl,
        now,
        existingVideo.id,
      )
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO videos
        (startup_id, video_url, platform, title, description, thumbnail, author, product_url_found, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        startupId,
        metadata.normalizedUrl,
        metadata.platform,
        metadata.title,
        metadata.description,
        metadata.thumbnail,
        metadata.author,
        normalizedProductUrl,
        now,
      )
      .run();
  }

  const rank = (await getStartupRank(c.env.DB, startupId)) ?? 1;
  const freshStartup = await getStartupById(c.env.DB, startupId);

  c.executionCtx.waitUntil(
    (async () => {
      if (!freshStartup) return;
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

      const board = await getLeaderboard(c.env.DB);
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
    },
  });
});

api.post("/report/:videoId", async (c) => {
  const ipHash = await hashIp(clientIp(c));
  const limited = await rateLimitReport(c.env.DB, ipHash);
  if (!limited.allowed) {
    return c.json(
      { error: `Too many reports. Try again in ${limited.retryAfterSeconds ?? 3600} seconds.` },
      429,
    );
  }

  const videoId = Number(c.req.param("videoId"));
  if (!Number.isFinite(videoId)) return c.json({ error: "Invalid video id" }, 400);

  const video = await getVideoById(c.env.DB, videoId);
  if (!video || video.removed_at) {
    return c.json({ error: "Video not found" }, 404);
  }

  const startup = await getStartupById(c.env.DB, video.startup_id);
  if (!startup || startup.removed_at) {
    return c.json({ error: "Startup not found" }, 404);
  }

  const now = new Date().toISOString();
  const reason = "ai";

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO reports (video_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)",
    ).bind(videoId, reason, ipHash, now),
    c.env.DB.prepare("UPDATE videos SET removed_at = ? WHERE startup_id = ?").bind(now, startup.id),
    c.env.DB.prepare(
      "UPDATE startups SET removed_at = ?, removal_reason = ? WHERE id = ?",
    ).bind(now, "Reported as AI-generated video", startup.id),
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
      });

      const board = await getLeaderboard(c.env.DB);
      for (const entry of board) {
        const other = await getStartupById(c.env.DB, entry.id);
        if (other) await notifyRankChange(c.env, c.env.DB, other, entry.rank);
      }
    })(),
  );

  return c.json({ ok: true, message: "Report accepted. Startup removed from the board." });
});
