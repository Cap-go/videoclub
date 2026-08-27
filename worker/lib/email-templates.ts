import type { EmailPayload } from "../types";

const ACCENT = "#f4623a";
const BG = "#faf8f5";
const TEXT = "#111111";
const MUTED = "#6b7280";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailShell(title: string, body: string, boardUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:32px 16px;background:${BG};color:${TEXT};font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8e4df;border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e8e4df;background:${BG};">
      <div style="font-size:18px;font-weight:700;">▶ videoclub.lol</div>
      <div style="font-size:13px;color:${MUTED};margin-top:4px;">Rank is the videos — nothing else.</div>
    </div>
    <div style="padding:24px;">
      ${body}
      <p style="margin:28px 0 0;">
        <a href="${escapeHtml(boardUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;">View the board →</a>
      </p>
    </div>
  </div>
</body></html>`;
}

export function buildEmailContent(payload: EmailPayload, appUrl: string) {
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
      boardUrl,
    ].join("\n");
    const html = emailShell(
      subject,
      `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to <strong>Video Club</strong>, ${escapeHtml(payload.startupName)}!</p>
       <p style="font-size:32px;font-weight:700;margin:0 0 8px;color:${ACCENT};">#${rank}</p>
       <p style="font-size:14px;color:${MUTED};margin:0 0 20px;">Your current rank on the All-time board</p>
       <p style="font-size:15px;line-height:1.6;margin:0;">Product: <a href="${escapeHtml(payload.productUrl)}" style="color:${ACCENT};">${escapeHtml(payload.productUrl)}</a></p>
       <p style="font-size:15px;line-height:1.6;margin:16px 0 0;">Keep posting real founder videos with your product link in the description.</p>`,
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
      `Old rank: #${from}`,
      `New rank: #${to}`,
      `Product: ${payload.productUrl}`,
      boardUrl,
    ].join("\n");
    const html = emailShell(
      subject,
      `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>${escapeHtml(payload.startupName)}</strong> moved on Video Club.</p>
       <p style="font-size:15px;line-height:1.6;margin:0;">Old rank: <strong>#${from}</strong><br/>New rank: <strong style="color:${ACCENT};">#${to}</strong></p>
       <p style="font-size:15px;line-height:1.6;margin:16px 0 0;">Product: <a href="${escapeHtml(payload.productUrl)}" style="color:${ACCENT};">${escapeHtml(payload.productUrl)}</a></p>`,
      boardUrl,
    );
    return { subject, text, html };
  }

  const reason = payload.removalReason ?? "Community report";
  const subject = "Removed from Video Club";
  const text = [
    `${payload.startupName} was removed from Video Club.`,
    `Reason: ${reason}`,
    `Reported video: ${payload.videoTitle ?? "Unknown"} — ${payload.videoUrl ?? ""}`,
    boardUrl,
  ].join("\n");
  const html = emailShell(
    subject,
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>${escapeHtml(payload.startupName)}</strong> was removed from Video Club.</p>
     <p style="font-size:15px;line-height:1.6;margin:0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
     <p style="font-size:15px;line-height:1.6;margin:16px 0 0;">Reported video: ${escapeHtml(payload.videoTitle ?? "Unknown")}<br/>
     <a href="${escapeHtml(payload.videoUrl ?? "")}" style="color:${ACCENT};word-break:break-all;">${escapeHtml(payload.videoUrl ?? "")}</a></p>`,
    boardUrl,
  );
  return { subject, text, html };
}

export const EMAIL_PREVIEW_FIXTURES: EmailPayload[] = [
  {
    kind: "welcome",
    to: "founder@capgo.app",
    startupName: "Capgo",
    productUrl: "https://capgo.app",
    rank: 4,
  },
  {
    kind: "rank_changed",
    to: "founder@capgo.app",
    startupName: "Capgo",
    productUrl: "https://capgo.app",
    rank: 2,
    previousRank: 5,
  },
  {
    kind: "removed",
    to: "founder@capgo.app",
    startupName: "Capgo",
    productUrl: "https://capgo.app",
    videoUrl: "https://www.youtube.com/watch?v=example",
    videoTitle: "Why we built Capgo — founder update",
    removalReason: "Reported as AI video",
  },
];
