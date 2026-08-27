import { useEffect, useState } from "react";
import { recordVideoPlay } from "../lib/stats";
import {
  buildEmbedInfo,
  X_EMBED_SHELL_CLASS,
  X_EMBED_POSTER_SHELL_CLASS,
  X_EMBED_IFRAME_CLASS,
  youtubeEmbedUrl,
  youtubePosterUrl,
} from "../../worker/lib/embed";

interface VideoEmbedProps {
  platform: string;
  videoId: string | null;
  dbVideoId: number;
  videoUrl: string;
  title: string;
  thumbnail: string | null;
  eager?: boolean;
  onPlayRecorded?: (playCount: number, startupPlayCount: number, totalPlays: number) => void;
}

let activeYoutubeStop: (() => void) | null = null;

function trackPlay(dbVideoId: number, onPlayRecorded?: VideoEmbedProps["onPlayRecorded"]) {
  void recordVideoPlay(dbVideoId).then((result) => {
    if (result) {
      onPlayRecorded?.(result.play_count, result.startup_play_count, result.total_plays);
    }
  });
}

function YouTubeClickToPlay({
  dbVideoId,
  videoId,
  title,
  thumbnail,
  watchUrl,
  eager,
  onPlayRecorded,
}: {
  dbVideoId: number;
  videoId: string;
  title: string;
  thumbnail: string | null;
  watchUrl: string;
  eager?: boolean;
  onPlayRecorded?: VideoEmbedProps["onPlayRecorded"];
}) {
  const [playing, setPlaying] = useState(false);
  const poster = thumbnail ?? youtubePosterUrl(videoId);

  const handlePlay = () => {
    activeYoutubeStop?.();
    const stop = () => setPlaying(false);
    activeYoutubeStop = stop;
    trackPlay(dbVideoId, onPlayRecorded);
    setPlaying(true);
  };

  useEffect(() => {
    return () => {
      activeYoutubeStop = null;
    };
  }, []);

  if (playing) {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    return (
      <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={youtubeEmbedUrl(videoId, origin)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 opacity-0 transition hover:text-white group-hover:opacity-100"
        >
          Watch on YouTube
        </a>
      </div>
    );
  }

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <img
        src={poster}
        alt=""
        className="h-full w-full object-cover"
        loading={eager ? "eager" : "lazy"}
      />
      <button
        type="button"
        onClick={handlePlay}
        aria-label={`Play ${title}`}
        className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4623a] pl-1 text-2xl text-white shadow-lg transition group-hover:scale-105">
          ▶
        </span>
      </button>
      <a
        href={watchUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 transition hover:text-white"
      >
        Watch on YouTube
      </a>
    </div>
  );
}

function XClickToPlay({
  dbVideoId,
  embedUrl,
  title,
  thumbnail,
  watchUrl,
  eager,
  onPlayRecorded,
}: {
  dbVideoId: number;
  embedUrl: string;
  title: string;
  thumbnail: string | null;
  watchUrl: string;
  eager?: boolean;
  onPlayRecorded?: VideoEmbedProps["onPlayRecorded"];
}) {
  const [playing, setPlaying] = useState(!thumbnail);

  useEffect(() => {
    if (playing && !thumbnail) {
      trackPlay(dbVideoId, onPlayRecorded);
    }
  }, [dbVideoId, onPlayRecorded, playing, thumbnail]);

  if (!playing && thumbnail) {
    return (
      <div className={`group relative aspect-[9/16] max-h-[640px] ${X_EMBED_POSTER_SHELL_CLASS}`}>
        <img
          src={thumbnail}
          alt=""
          className="h-full w-full object-cover"
          loading={eager ? "eager" : "lazy"}
        />
        <button
          type="button"
          onClick={() => {
            trackPlay(dbVideoId, onPlayRecorded);
            setPlaying(true);
          }}
          aria-label={`Play ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4623a] pl-1 text-2xl text-white shadow-lg transition group-hover:scale-105">
            ▶
          </span>
        </button>
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 transition hover:text-white"
        >
          Watch on X
        </a>
      </div>
    );
  }

  return (
    <div className={`group ${X_EMBED_SHELL_CLASS}`}>
      <iframe
        src={embedUrl}
        title={title}
        loading={eager ? "eager" : "lazy"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className={X_EMBED_IFRAME_CLASS}
      />
      <a
        href={watchUrl}
        target="_blank"
        rel="noreferrer"
        className="block px-3 py-2 text-right text-xs text-[#6b7280] transition hover:text-[#111] group-hover:underline"
      >
        Watch on X
      </a>
    </div>
  );
}

function AutoPlayEmbed({
  dbVideoId,
  embedUrl,
  title,
  aspectClass,
  eager,
  onPlayRecorded,
}: {
  dbVideoId: number;
  embedUrl: string;
  title: string;
  aspectClass: string;
  eager?: boolean;
  onPlayRecorded?: VideoEmbedProps["onPlayRecorded"];
}) {
  const handleLoad = () => {
    trackPlay(dbVideoId, onPlayRecorded);
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-black ${aspectClass}`}>
      <iframe
        src={embedUrl}
        title={title}
        loading={eager ? "eager" : "lazy"}
        onLoad={handleLoad}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

export function VideoEmbed({
  platform,
  videoId,
  dbVideoId,
  title,
  thumbnail,
  videoUrl,
  eager = false,
  onPlayRecorded,
}: VideoEmbedProps) {
  const embed = buildEmbedInfo(platform, videoId ?? "", videoUrl);

  if (platform === "youtube" && videoId) {
    return (
      <YouTubeClickToPlay
        dbVideoId={dbVideoId}
        videoId={videoId}
        title={title}
        thumbnail={thumbnail}
        watchUrl={embed.watchUrl}
        eager={eager}
        onPlayRecorded={onPlayRecorded}
      />
    );
  }

  if (platform === "x" && embed.mode === "iframe" && embed.embedUrl) {
    return (
      <XClickToPlay
        dbVideoId={dbVideoId}
        embedUrl={embed.embedUrl}
        title={title}
        thumbnail={thumbnail}
        watchUrl={embed.watchUrl}
        eager={eager}
        onPlayRecorded={onPlayRecorded}
      />
    );
  }

  if (embed.mode === "iframe" && embed.embedUrl) {
    const aspectClass =
      platform === "tiktok" ? "aspect-[9/16] max-h-[640px]" : "aspect-video";

    return (
      <AutoPlayEmbed
        dbVideoId={dbVideoId}
        embedUrl={embed.embedUrl}
        title={title}
        aspectClass={aspectClass}
        eager={eager}
        onPlayRecorded={onPlayRecorded}
      />
    );
  }

  return (
    <a
      href={embed.watchUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-[#f3f4f6]"
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl text-[#9ca3af]">▶</div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/40">
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#111] shadow">
          Watch on {platform === "instagram" ? "Instagram" : platform === "x" ? "X" : "platform"}
        </span>
      </div>
    </a>
  );
}
