import { Link } from "react-router-dom";
import { type ChallengeReason, type FeedVideo } from "../lib/api";
import { formatStatCount } from "../lib/stats";
import { formatDate, platformLabel, timeAgo } from "../lib/format";
import { ChallengeControl } from "./ChallengeControl";
import { ProductDomainLink } from "./ProductDomainLink";
import { StartupLogo } from "./StartupLogo";
import { VideoEmbed } from "./VideoEmbed";

interface FeedCardProps {
  video: FeedVideo;
  eagerEmbed?: boolean;
  onChallenge: (videoId: number, reason: ChallengeReason) => void;
  onPlayUpdate?: (
    videoId: number,
    playCount: number,
    startupPlayCount: number,
    totalPlays: number,
  ) => void;
  onClickUpdate?: (startupId: number, clickCount: number, totalClicks: number) => void;
}

export function FeedCard({
  video,
  eagerEmbed = false,
  onChallenge,
  onPlayUpdate,
  onClickUpdate,
}: FeedCardProps) {
  const sortAt = video.published_at ?? video.submitted_at;

  return (
    <article
      id={`video-${video.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#e8e4df] bg-white shadow-sm"
    >
      <VideoEmbed
        platform={video.platform}
        videoId={video.video_id}
        dbVideoId={video.id}
        videoUrl={video.video_url}
        title={video.title}
        thumbnail={video.thumbnail}
        eager={eagerEmbed}
        onPlayRecorded={(playCount, startupPlayCount, totalPlays) => {
          onPlayUpdate?.(video.id, playCount, startupPlayCount, totalPlays);
        }}
      />

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <StartupLogo
            host={video.startup.product_host}
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl border border-[#e8e4df] bg-white object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {video.startup.rank != null && (
                <span className="rounded-full bg-[#f4623a] px-2 py-0.5 text-xs font-bold text-white">
                  #{video.startup.rank}
                </span>
              )}
              <span className="truncate text-base font-bold text-[#111]">{video.startup.name}</span>
            </div>
            <h2 className="mt-1 line-clamp-2 text-sm font-medium text-[#374151]">{video.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9ca3af]">
              <span>{platformLabel(video.platform)}</span>
              <span>·</span>
              <span>{timeAgo(sortAt)}</span>
              {video.published_at && (
                <>
                  <span>·</span>
                  <span>published {formatDate(video.published_at)}</span>
                </>
              )}
              <span>·</span>
              <span>{formatStatCount(video.play_count, "play")}</span>
              {video.challenge_count > 0 && (
                <>
                  <span>·</span>
                  <span className="font-medium text-[#b45309]">
                    {video.challenge_count} challenge{video.challenge_count === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e8e4df] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <ProductDomainLink
              href={video.product_url}
              host={video.startup.product_host}
              startupId={video.startup.id}
              onClickRecorded={(clickCount, totalClicks) => {
                onClickUpdate?.(video.startup.id, clickCount, totalClicks);
              }}
            />
            <span className="text-xs text-[#9ca3af]">
              {formatStatCount(video.startup.click_count, "click")} ·{" "}
              {formatStatCount(video.startup.play_count, "play")}
            </span>
            <Link to="/" className="text-[#6b7280] hover:text-[#111]">
              Leaderboard
            </Link>
          </div>
          <ChallengeControl videoId={video.id} onChallenge={onChallenge} layout="row" />
        </div>
      </div>
    </article>
  );
}
