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

type NewStartupEmailModalProps = {
  open: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onSave: (email: string) => void;
  onClose: () => void;
};

export function NewStartupEmailModal({
  open,
  email,
  onEmailChange,
  onSave,
  onClose,
}: NewStartupEmailModalProps) {
  const titleId = useId();
  const saveRef = useRef<HTMLButtonElement>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = isValidEmail(email);
  const showEmailError = emailTouched && !emailValid;

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
    setEmailTouched(true);
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) return;

    try {
      localStorage.setItem(EMAIL_PREFILL_KEY, trimmed);
    } catch {
      // ignore
    }
    onSave(trimmed);
  };

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
          First time on the board
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-[#374151]">
          This product isn&apos;t on Video Club yet. We need your email before you can post — not a newsletter.
        </p>

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

        <button
          ref={saveRef}
          type="button"
          onClick={handleSave}
          disabled={!emailValid}
          className="mt-5 w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save and continue
        </button>
      </div>
    </div>
  );
}
