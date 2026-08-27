import { useEffect, useId, useRef, useState } from "react";
import type { ChallengeReason } from "../lib/api";

export const CHALLENGE_OPTIONS: Array<{ value: ChallengeReason; label: string }> = [
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
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ChallengeReason | null>(null);
  const titleId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    setSelectedReason(null);
    submitRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const containerClass =
    layout === "row"
      ? "flex flex-wrap items-center gap-2"
      : "flex shrink-0 flex-col gap-2 sm:items-end";

  const handleSubmit = () => {
    if (!selectedReason) return;
    onChallenge(videoId, selectedReason);
    setOpen(false);
  };

  return (
    <>
      <div className={containerClass}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-[#fcd4c4] bg-[#fff9f7] px-4 py-2.5 text-sm font-medium text-[#c2410c] transition hover:bg-[#ffe8df]"
        >
          Challenge
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[#111]/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e8e4df] bg-[#faf8f5] p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-[#9ca3af] transition hover:bg-white hover:text-[#111]"
              aria-label="Close"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </button>

            <h2 id={titleId} className="pr-8 text-xl font-bold text-[#111]">
              Challenge this video
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-[#374151]">
              Three distinct challenges take it off the board.
            </p>

            <div className="mt-5 space-y-2" role="radiogroup" aria-labelledby={titleId}>
              {CHALLENGE_OPTIONS.map((opt) => {
                const checked = selectedReason === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-base font-medium transition ${
                      checked
                        ? "border-[#f4623a] bg-white ring-2 ring-[#f4623a]/20"
                        : "border-[#e8e4df] bg-white hover:border-[#fcd4c4]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`challenge-reason-${videoId}`}
                      value={opt.value}
                      checked={checked}
                      onChange={() => setSelectedReason(opt.value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        checked ? "border-[#f4623a]" : "border-[#d1d5db]"
                      }`}
                    >
                      {checked && <span className="h-2.5 w-2.5 rounded-full bg-[#f4623a]" />}
                    </span>
                    {opt.label}
                  </label>
                );
              })}
            </div>

            <button
              ref={submitRef}
              type="button"
              onClick={handleSubmit}
              disabled={!selectedReason}
              className="mt-5 w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit challenge
            </button>
          </div>
        </div>
      )}
    </>
  );
}
