export type ChallengeReason = "ai" | "not_founder" | "not_real_product";

export const CHALLENGE_THRESHOLD = 3;

export const CHALLENGE_REASONS: Array<{ value: ChallengeReason; label: string }> = [
  { value: "ai", label: "AI video" },
  { value: "not_founder", label: "Not the founder" },
  { value: "not_real_product", label: "Not a real product" },
];

export const REMOVED_HOST_MESSAGE =
  "This startup was removed after challenges. You cannot re-add this product.";

export function parseChallengeReason(value: unknown): ChallengeReason | null {
  if (typeof value !== "string") return null;
  return CHALLENGE_REASONS.some((r) => r.value === value) ? (value as ChallengeReason) : null;
}

export function challengeReasonLabel(reason: ChallengeReason): string {
  return CHALLENGE_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** Plain-language reason for the first-challenge heads-up email. */
export function challengedAsText(reason: ChallengeReason): string {
  switch (reason) {
    case "ai":
      return "AI video";
    case "not_founder":
      return "not the founder";
    case "not_real_product":
      return "not a real product";
    default:
      return "invalid";
  }
}
