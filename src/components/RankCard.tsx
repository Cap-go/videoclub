import { Link } from "react-router-dom";
import { type ChallengeReason, type LeaderboardEntry, type StartupVideo } from "../lib/api";
import { formatDate, platformLabel, timeAgo } from "../lib/format";
import { ChallengeControl } from "./ChallengeControl";
import { ProductDomainLink } from "./ProductDomainLink";
import { StartupLogo } from "./StartupLogo";

interface RankCardProps {
  entry: LeaderboardEntry;
  expanded: boolean;
  videosLoading: boolean;
  videos: StartupVideo[];
  onToggle: () => void;
  onChallenge: (videoId: number, reason: ChallengeReason) => void;
}

export function RankCard({
  entry,
  expanded,
  videosLoading,
  videos,
  onToggle,
  onChallenge,
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

        <StartupLogo
          host={entry.product_host}
          className="mt-0.5 h-11 w-11 shrink-0 rounded-xl border border-[#e8e4df] bg-white object-cover sm:h-12 sm:w-12"
        />

        <div className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold text-[#111] sm:text-lg">{entry.name}</span>
          <p className="mt-0.5 line-clamp-2 text-sm text-[#6b7280]">
            {entry.video_count} founder video{entry.video_count === 1 ? "" : "s"} about{" "}
            <ProductDomainLink href={entry.product_url} host={entry.product_host} />
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9ca3af]">
            <span>{timeAgo(entry.first_video_at)}</span>
            <span>·</span>
            <ProductDomainLink
              href={entry.product_url}
              host={entry.product_host}
              className="text-xs font-medium text-[#f4623a] underline underline-offset-2 decoration-[#f4623a]/70 hover:decoration-[#f4623a]"
            />
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
                  <Link
                    to={`/feed#video-${video.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center"
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
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9ca3af]">
                        <span>{platformLabel(video.platform)}</span>
                        {video.published_at && (
                          <>
                            <span>·</span>
                            <span>published {formatDate(video.published_at)}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>submitted {timeAgo(video.submitted_at)}</span>
                        {video.challenge_count > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-[#b45309]">
                              {video.challenge_count} challenge{video.challenge_count === 1 ? "" : "s"}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="mt-1 inline-block text-sm font-medium text-[#f4623a] hover:underline">
                        Watch in feed
                      </span>
                    </div>
                  </Link>
                  <ChallengeControl videoId={video.id} onChallenge={onChallenge} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
