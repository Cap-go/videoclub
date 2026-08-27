import { Link } from "react-router-dom";
import { faviconUrl, type ChallengeReason, type FeedVideo } from "../lib/api";
import { formatDate, platformLabel, timeAgo } from "../lib/format";
import { ChallengeControl } from "./ChallengeControl";
import { VideoEmbed } from "./VideoEmbed";

interface FeedCardProps {
  video: FeedVideo;
  eagerEmbed?: boolean;
  onChallenge: (videoId: number, reason: ChallengeReason) => void;
}

export function FeedCard({ video, eagerEmbed = false, onChallenge }: FeedCardProps) {
  const sortAt = video.published_at ?? video.submitted_at;

  return (
    <article
      id={`video-${video.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#e8e4df] bg-white shadow-sm"
    >
      <VideoEmbed
        platform={video.platform}
        videoId={video.video_id}
        videoUrl={video.video_url}
        title={video.title}
        thumbnail={video.thumbnail}
        eager={eagerEmbed}
      />

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <img
            src={faviconUrl(video.startup.product_host)}
            alt=""
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl border border-[#e8e4df] bg-white object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {video.startup.rank != null && (
                <span className="rounded-full bg-[#f4623a] px-2 py-0.5 text-xs font-bold text-white">
                  #{video.startup.rank}
                </span>
              )}
              <a
                href={video.product_url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-base font-bold text-[#111] hover:text-[#f4623a]"
              >
                {video.startup.name}
              </a>
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
            <a
              href={video.product_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#f4623a] hover:underline"
            >
              {video.startup.product_host}
            </a>
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
