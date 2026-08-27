import type { ChallengeReason } from "../lib/api";

const CHALLENGE_OPTIONS: Array<{ value: ChallengeReason; label: string }> = [
  { value: "ai", label: "AI video" },
  { value: "not_founder", label: "Not the founder" },
  { value: "not_real_product", label: "Not a real product" },
];

interface ChallengeControlProps {
  videoId: number;
  onChallenge: (videoId: number, reason: ChallengeReason) => void;
  layout?: "row" | "stack";
}

export function ChallengeControl({ videoId, onChallenge, layout = "stack" }: ChallengeControlProps) {
  const containerClass =
    layout === "row"
      ? "flex flex-wrap items-center gap-2"
      : "flex shrink-0 flex-col gap-2 sm:items-end";

  return (
    <div className={containerClass}>
      <label className="sr-only" htmlFor={`challenge-${videoId}`}>
        Challenge reason
      </label>
      <select
        id={`challenge-${videoId}`}
        defaultValue="ai"
        className="rounded-xl border border-[#e8e4df] bg-white px-2 py-2 text-base text-[#374151] sm:text-xs"
      >
        {CHALLENGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={(e) => {
          const select = e.currentTarget.parentElement?.querySelector("select");
          onChallenge(videoId, (select?.value ?? "ai") as ChallengeReason);
        }}
        className="rounded-xl border border-[#fcd4c4] bg-[#fff9f7] px-3 py-2 text-xs font-medium text-[#c2410c] transition hover:bg-[#ffe8df]"
      >
        Challenge
      </button>
    </div>
  );
}
