import { useEffect, useId, useRef, useState } from "react";

const EMAIL_PREFILL_KEY = "videoclub.email";

export function getPrefilledEmail(): string {
  try {
    return localStorage.getItem(EMAIL_PREFILL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type ProductCandidate = {
  host: string;
  product_url: string;
  isNew: boolean;
};

type NewStartupEmailModalProps = {
  open: boolean;
  candidates: ProductCandidate[];
  selectedHost: string;
  onSelectedHostChange: (host: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onSave: (payload: { host: string; email?: string }) => void;
  onClose: () => void;
};

export function NewStartupEmailModal({
  open,
  candidates,
  selectedHost,
  onSelectedHostChange,
  email,
  onEmailChange,
  onSave,
  onClose,
}: NewStartupEmailModalProps) {
  const titleId = useId();
  const saveRef = useRef<HTMLButtonElement>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const selectedCandidate =
    candidates.find((candidate) => candidate.host === selectedHost) ?? candidates[0];
  const showPicker = candidates.length > 1;
  const emailNeeded = selectedCandidate?.isNew ?? false;
  const emailValid = isValidEmail(email);
  const showEmailError = emailTouched && emailNeeded && !emailValid;
  const canSave = Boolean(selectedCandidate) && (!emailNeeded || emailValid);

  useEffect(() => {
    if (!open) return;

    setEmailTouched(false);
    saveRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!selectedCandidate) return;
    if (emailNeeded) {
      setEmailTouched(true);
      const trimmed = email.trim();
      if (!trimmed || !isValidEmail(trimmed)) return;
      try {
        localStorage.setItem(EMAIL_PREFILL_KEY, trimmed);
      } catch {
        // ignore
      }
      onSave({ host: selectedCandidate.host, email: trimmed });
      return;
    }
    onSave({ host: selectedCandidate.host });
  };

  const title = showPicker ? "Which product is this for?" : "First time on the board";

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
          {title}
        </h2>

        {showPicker ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-[#374151]">
              This video links more than one product. Pick exactly one domain for this post.
            </p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Product domain">
              {candidates.map((candidate) => {
                const checked = candidate.host === selectedHost;
                return (
                  <label
                    key={candidate.host}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${
                      checked
                        ? "border-[#f4623a] bg-white ring-2 ring-[#f4623a]/20"
                        : "border-[#e8e4df] bg-white hover:border-[#f4623a]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="product-host"
                      value={candidate.host}
                      checked={checked}
                      onChange={() => onSelectedHostChange(candidate.host)}
                      className="h-4 w-4 shrink-0 accent-[#f4623a]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#f4623a]">{candidate.host}</span>
                      <span className="mt-0.5 block text-xs text-[#6b7280]">
                        {candidate.isNew ? "New on Video Club" : "Already on the board"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        ) : selectedCandidate ? (
          <p className="mt-3 text-sm leading-relaxed text-[#374151]">
            This product isn&apos;t on Video Club yet:{" "}
            <span className="font-semibold text-[#f4623a]">{selectedCandidate.host}</span>. We need
            your email before you can post — not a newsletter.
          </p>
        ) : null}

        {emailNeeded && (
          <>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[#374151]">
              <li>If another maker outranks you</li>
              <li>If someone challenges one of your videos</li>
              <li>If a video is removed or your whole listing comes off the board</li>
            </ul>

            <div className="mt-5 space-y-1">
              <label htmlFor="new-startup-email" className="block text-sm font-medium text-[#111]">
                Email for rank + removal updates
              </label>
              <input
                id="new-startup-email"
                type="email"
                required
                placeholder="you@startup.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-invalid={showEmailError}
                aria-describedby={showEmailError ? "new-startup-email-error" : undefined}
                className="w-full rounded-2xl border border-[#e8e4df] bg-white px-4 py-3 text-[#111] outline-none transition focus:border-[#f4623a] focus:ring-2 focus:ring-[#f4623a]/20"
              />
              {showEmailError && (
                <p id="new-startup-email-error" className="text-sm text-[#dc2626]">
                  Enter a valid email to continue.
                </p>
              )}
            </div>
          </>
        )}

        {!emailNeeded && selectedCandidate && showPicker && (
          <p className="mt-4 text-sm leading-relaxed text-[#374151]">
            You&apos;re adding a video for{" "}
            <span className="font-semibold text-[#f4623a]">{selectedCandidate.host}</span> — no email
            needed.
          </p>
        )}

        <button
          ref={saveRef}
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="mt-5 w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save and continue
        </button>
      </div>
    </div>
  );
}
