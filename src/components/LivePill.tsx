interface LivePillProps {
  startupCount: number;
  videoCount: number;
  totalClicks: number;
  totalPlays: number;
}

/** Board totals — neutral chip so it doesn't compete with the live visitors pill. */
export function LivePill({ startupCount, videoCount, totalClicks, totalPlays }: LivePillProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#e8e4df] bg-white px-4 py-1.5 text-sm text-[#6b7280] shadow-[0_1px_0_rgba(17,17,17,0.03)]">
        <span>
          {startupCount} startup{startupCount === 1 ? "" : "s"} · {videoCount} video
          {videoCount === 1 ? "" : "s"} posted
        </span>
        <span className="hidden text-[#d1d5db] sm:inline">·</span>
        <span>
          {totalClicks} product click{totalClicks === 1 ? "" : "s"} · {totalPlays} on-site play
          {totalPlays === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
