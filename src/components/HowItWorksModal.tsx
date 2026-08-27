import { useEffect, useId, useRef } from "react";

type HowItWorksModalProps = {
  open: boolean;
  onClose: () => void;
};

export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  const titleId = useId();
  const gotItRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    gotItRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#111]/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e8e4df] bg-[#faf8f5] p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#9ca3af] transition hover:bg-white hover:text-[#111]"
          aria-label="Close"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>

        <h2 id={titleId} className="pr-8 text-xl font-bold text-[#111]">
          How videoclub works
        </h2>

        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#374151]">
          <li>
            Paste a <strong className="font-semibold text-[#111]">founder video</strong> URL — YouTube, TikTok,
            Instagram, or X. Not your product website.
          </li>
          <li>
            The video description (or tweet) must contain your{" "}
            <strong className="font-semibold text-[#111]">product link</strong>. That&apos;s how we know which
            startup it is. Same talk on two platforms counts twice; the same video id never does.
          </li>
          <li>
            The leaderboard ranks <strong className="font-semibold text-[#111]">products</strong> by how many
            legit founder videos mention them. Same count? Oldest video wins. That&apos;s why you see SaaS
            icons, not channel avatars.
          </li>
          <li>
            On X, if there&apos;s no URL in the tweet, a tagged business account counts — we use that
            account&apos;s profile website, not your personal site.
          </li>
        </ul>

        <button
          ref={gotItRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
