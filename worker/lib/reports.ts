export type ReportReason = "ai" | "not_founder" | "no_product_link" | "other";

export const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "ai", label: "AI video" },
  { value: "not_founder", label: "Not the founder" },
  { value: "no_product_link", label: "No product link" },
  { value: "other", label: "Other" },
];

export function parseReportReason(value: unknown): ReportReason | null {
  if (typeof value !== "string") return null;
  return REPORT_REASONS.some((r) => r.value === value) ? (value as ReportReason) : null;
}

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function removalReasonText(reason: ReportReason): string {
  switch (reason) {
    case "ai":
      return "Reported as AI video";
    case "not_founder":
      return "Reported as not the founder";
    case "no_product_link":
      return "Reported — no product link";
    case "other":
      return "Reported by the community";
    default:
      return "Reported by the community";
  }
}
