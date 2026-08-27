import type { EmailPayload, Env } from "../types";

export async function sendEmail(env: Env, payload: EmailPayload): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY missing, skipping", payload.kind, payload.to);
    return;
  }

  const { subject, text, html } = buildEmailContent(payload, env.APP_URL);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [payload.to],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error", res.status, body);
  }
}

function buildEmailContent(payload: EmailPayload, appUrl: string) {
  const boardUrl = appUrl;

  if (payload.kind === "welcome") {
    const rank = payload.rank ?? "?";
    const subject = `You're on Video Club at #${rank}`;
    const text = [
      `Welcome to Video Club, ${payload.startupName}!`,
      ``,
      `You're on the board at rank #${rank}.`,
      `Product: ${payload.productUrl}`,
      ``,
      `Keep posting real founder videos with your product link in the description.`,
      `Rank is the videos. Real founder. Real product link. No AI.`,
      ``,
      `Board: ${boardUrl}`,
    ].join("\n");
    const html = emailShell(
      subject,
      `<p>Welcome to <strong>Video Club</strong>, ${escapeHtml(payload.startupName)}!</p>
       <p>You're on the board at <strong>#${rank}</strong>.</p>
       <p>Product: <a href="${escapeHtml(payload.productUrl)}">${escapeHtml(payload.productUrl)}</a></p>
       <p>Keep posting real founder videos with your product link in the description.</p>
       <p><em>Rank is the videos. Real founder. Real product link. No AI.</em></p>`,
      boardUrl,
    );
    return { subject, text, html };
  }

  if (payload.kind === "rank_changed") {
    const from = payload.previousRank ?? "?";
    const to = payload.rank ?? "?";
    const subject = `Video Club rank update: #${from} → #${to}`;
    const text = [
      `${payload.startupName} moved on Video Club.`,
      ``,
      `Old rank: #${from}`,
      `New rank: #${to}`,
      `Product: ${payload.productUrl}`,
      ``,
      `Post more real founder videos to climb.`,
      `Board: ${boardUrl}`,
    ].join("\n");
    const html = emailShell(
      subject,
      `<p><strong>${escapeHtml(payload.startupName)}</strong> moved on Video Club.</p>
       <p>Old rank: <strong>#${from}</strong><br/>New rank: <strong>#${to}</strong></p>
       <p>Product: <a href="${escapeHtml(payload.productUrl)}">${escapeHtml(payload.productUrl)}</a></p>
       <p>Post more real founder videos to climb.</p>`,
      boardUrl,
    );
    return { subject, text, html };
  }

  const subject = "Removed from Video Club — AI report";
  const text = [
    `${payload.startupName} was removed from Video Club.`,
    ``,
    `Reason: a video was reported as AI-generated.`,
    `Reported video: ${payload.videoTitle ?? "Unknown"} — ${payload.videoUrl ?? ""}`,
    ``,
    `One AI report removes the video and the entire startup from the board.`,
    `If this was a mistake, reply and we'll look into it.`,
    ``,
    `Board: ${boardUrl}`,
  ].join("\n");
  const html = emailShell(
    subject,
    `<p><strong>${escapeHtml(payload.startupName)}</strong> was removed from Video Club.</p>
     <p>Reason: a video was reported as AI-generated.</p>
     <p>Reported video: ${escapeHtml(payload.videoTitle ?? "Unknown")}<br/>
     <a href="${escapeHtml(payload.videoUrl ?? "")}">${escapeHtml(payload.videoUrl ?? "")}</a></p>
     <p>One AI report removes the video and the entire startup from the board.</p>`,
    boardUrl,
  );
  return { subject, text, html };
}

function emailShell(title: string, body: string, boardUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px;">
  <div style="max-width:520px;margin:0 auto;">
    ${body}
    <p style="margin-top:24px;"><a href="${escapeHtml(boardUrl)}" style="color:#ff4444;">View Video Club →</a></p>
  </div>
</body></html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
