interface LivePillProps {
  startupCount: number;
  videoCount: number;
  totalClicks: number;
  totalPlays: number;
}

export function LivePill({ startupCount, videoCount, totalClicks, totalPlays }: LivePillProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#d1fae5] bg-[#ecfdf5] px-4 py-1.5 text-sm text-[#065f46]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
        </span>
        <span>
          {startupCount} startup{startupCount === 1 ? "" : "s"} · {videoCount} video
          {videoCount === 1 ? "" : "s"} posted
        </span>
        <span className="hidden text-[#6ee7b7] sm:inline">·</span>
        <span className="font-medium">
          {totalClicks} product click{totalClicks === 1 ? "" : "s"} · {totalPlays} on-site play
          {totalPlays === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
