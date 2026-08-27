import { buildEmailContent } from "./email-templates";
import type { EmailPayload, Env } from "../types";

export async function sendEmail(env: Env, payload: EmailPayload): Promise<void> {
  if (!env.EMAIL) {
    console.warn("[email] EMAIL binding missing, skipping", payload.kind, payload.to);
    return;
  }

  const { subject, text, html } = buildEmailContent(payload, env.APP_URL);

  try {
    const response = await env.EMAIL.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject,
      html,
      text,
    });
    console.log("[email] sent", payload.kind, payload.to, response.messageId);
  } catch (err) {
    console.error("[email] send failed", payload.kind, payload.to, err);
  }
}

export async function notifyRankChange(
  env: Env,
  db: D1Database,
  startup: { id: number; name: string; email: string; product_url: string; last_notified_rank: number | null },
  newRank: number,
): Promise<void> {
  if (startup.last_notified_rank === newRank) return;
  await sendEmail(env, {
    kind: "rank_changed",
    to: startup.email,
    startupName: startup.name,
    productUrl: startup.product_url,
    rank: newRank,
    previousRank: startup.last_notified_rank,
  });
  await db
    .prepare("UPDATE startups SET last_notified_rank = ? WHERE id = ?")
    .bind(newRank, startup.id)
    .run();
}

export { buildEmailContent, EMAIL_PREVIEW_FIXTURES } from "./email-templates";
