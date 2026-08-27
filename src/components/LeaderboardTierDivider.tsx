interface LeaderboardTierDividerProps {
  label: string;
  ariaLabel: string;
}

export function LeaderboardTierDivider({ label, ariaLabel }: LeaderboardTierDividerProps) {
  return (
    <div className="relative py-5 md:py-7" role="separator" aria-label={ariaLabel}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#f4623a]/30" />
      <div className="relative flex justify-center">
        <span className="rounded-full border border-[#f4623a]/25 bg-[#f4623a]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f4623a]">
          {label}
        </span>
      </div>
    </div>
  );
}
