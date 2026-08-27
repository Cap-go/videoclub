import { useEffect, useId, useRef } from "react";

const EMAIL_PREFILL_KEY = "videoclub.email";

export function getPrefilledEmail(): string {
  try {
    return localStorage.getItem(EMAIL_PREFILL_KEY) ?? "";
  } catch {
    return "";
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type HowItWorksModalProps = {
  open: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onClose: (savedEmail?: string) => void;
};

export function HowItWorksModal({ open, email, onEmailChange, onClose }: HowItWorksModalProps) {
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

  const handleGotIt = () => {
    const trimmed = email.trim();
    if (trimmed && isValidEmail(trimmed)) {
      try {
        localStorage.setItem(EMAIL_PREFILL_KEY, trimmed);
      } catch {
        // ignore
      }
      onClose(trimmed);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#111]/40"
        aria-label="Close"
        onClick={() => onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e8e4df] bg-[#faf8f5] p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={() => onClose()}
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
            legit founder videos mention them. That&apos;s why you see SaaS icons, not channel avatars.
          </li>
          <li>
            On X, if there&apos;s no URL in the tweet, a tagged business account counts — we use that
            account&apos;s profile website, not your personal site.
          </li>
          <li>
            Email is only asked the <strong className="font-semibold text-[#111]">first time a new product</strong>{" "}
            hits the board, so we can ping you if someone outranks you. Not a newsletter.
          </li>
        </ul>

        <div className="mt-5 space-y-1">
          <label htmlFor="how-it-works-email" className="block text-sm font-medium text-[#111]">
            Email for rank updates <span className="font-normal text-[#9ca3af]">(optional)</span>
          </label>
          <input
            id="how-it-works-email"
            type="email"
            placeholder="you@startup.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-2xl border border-[#e8e4df] bg-white px-4 py-3 text-[#111] outline-none transition focus:border-[#f4623a] focus:ring-2 focus:ring-[#f4623a]/20"
          />
        </div>

        <button
          ref={gotItRef}
          type="button"
          onClick={handleGotIt}
          className="mt-5 w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
