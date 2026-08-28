interface LeaderboardTierDividerProps {
  label: string;
  ariaLabel: string;
}

export function LeaderboardTierDivider({ label, ariaLabel }: LeaderboardTierDividerProps) {
  return (
    <div className="relative py-4 md:py-6" role="separator" aria-label={ariaLabel}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#f4623a]/35" />
      <div className="relative flex justify-center">
        <span className="rounded-full border border-[#f4623a]/30 bg-[#faf8f5] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f4623a]">
          {label}
        </span>
      </div>
    </div>
  );
}
