import { faviconUrl, type LeaderboardEntry, type ReportReason, type StartupVideo } from "../lib/api";
import { formatDate, platformLabel, timeAgo } from "../lib/format";

const REPORT_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: "ai", label: "AI video" },
  { value: "not_founder", label: "Not the founder" },
  { value: "no_product_link", label: "No product link" },
  { value: "other", label: "Other" },
];

interface RankCardProps {
  entry: LeaderboardEntry;
  expanded: boolean;
  videosLoading: boolean;
  videos: StartupVideo[];
  onToggle: () => void;
  onReport: (videoId: number, reason: ReportReason) => void;
}

export function RankCard({
  entry,
  expanded,
  videosLoading,
  videos,
  onToggle,
  onReport,
}: RankCardProps) {
  const isTopThree = entry.rank <= 3;
  const claimTarget = entry.rank === 1 ? entry.video_count + 1 : null;

  return (
    <div
      className={
        isTopThree
          ? "overflow-hidden rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] shadow-sm"
          : "overflow-hidden rounded-2xl border border-[#e8e4df] bg-white"
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-[#faf8f5]/80 sm:gap-4 sm:p-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4623a] text-sm font-bold text-white sm:h-11 sm:w-11 sm:text-base">
          #{entry.rank}
        </span>

        <img
          src={faviconUrl(entry.product_host)}
          alt=""
          className="mt-0.5 h-11 w-11 shrink-0 rounded-xl border border-[#e8e4df] bg-white object-cover sm:h-12 sm:w-12"
          loading="lazy"
        />

        <div className="min-w-0 flex-1">
          <a
            href={entry.product_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-base font-bold text-[#111] hover:text-[#f4623a] sm:text-lg"
          >
            {entry.name}
          </a>
          <p className="mt-0.5 line-clamp-2 text-sm text-[#6b7280]">
            {entry.video_count} founder video{entry.video_count === 1 ? "" : "s"} about{" "}
            {entry.product_host}
            {entry.founder_name && <> · {entry.founder_name}</>}
          </p>
          {entry.name_unconfirmed && (
            <p className="mt-1 text-xs text-[#b45309]">Name not on the video</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9ca3af]">
            <span>{timeAgo(entry.first_video_at)}</span>
            <span>·</span>
            <span>{entry.product_host}</span>
            {claimTarget && entry.rank === 1 && (
              <>
                <span>·</span>
                <span className="text-[#f4623a]">claim #1 with {claimTarget} videos</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-[#f4623a] sm:text-3xl">
            {entry.video_count}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af]">videos</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#e8e4df] bg-[#faf8f5] px-4 py-4 sm:px-5">
          {videosLoading ? (
            <p className="text-sm text-[#6b7280]">Loading videos…</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No videos</p>
          ) : (
            <ul className="space-y-3">
              {videos.map((video) => (
                <li
                  key={video.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#e8e4df] bg-white p-3 sm:flex-row sm:items-center"
                >
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt=""
                      className="h-20 w-full rounded-xl object-cover sm:h-16 sm:w-28"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded-xl bg-[#f3f4f6] text-2xl text-[#9ca3af] sm:h-16 sm:w-28">
                      ▶
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[#111]">{video.title}</div>
                    <div className="mt-1 text-xs text-[#9ca3af]">
                      {platformLabel(video.platform)}
                      {video.published_at && (
                        <> · published {formatDate(video.published_at)}</>
                      )}
                      <> · submitted {timeAgo(video.submitted_at)}</>
                    </div>
                    <a
                      href={video.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm font-medium text-[#f4623a] hover:underline"
                    >
                      Watch
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <label className="sr-only" htmlFor={`report-${video.id}`}>
                      Report reason
                    </label>
                    <select
                      id={`report-${video.id}`}
                      defaultValue="ai"
                      className="rounded-xl border border-[#e8e4df] bg-white px-2 py-2 text-xs text-[#374151]"
                    >
                      {REPORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={(e) => {
                        const select = e.currentTarget.parentElement?.querySelector("select");
                        onReport(video.id, (select?.value ?? "ai") as ReportReason);
                      }}
                      className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#dc2626] transition hover:bg-[#fee2e2]"
                    >
                      Report
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
