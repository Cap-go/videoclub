import { buildEmbedInfo } from "../../worker/lib/embed";

interface VideoEmbedProps {
  platform: string;
  videoId: string | null;
  videoUrl: string;
  title: string;
  thumbnail: string | null;
  eager?: boolean;
}

export function VideoEmbed({ platform, videoId, videoUrl, title, thumbnail, eager = false }: VideoEmbedProps) {
  const embed = buildEmbedInfo(platform, videoId ?? "", videoUrl);

  if (embed.mode === "iframe" && embed.embedUrl) {
    const aspectClass =
      platform === "tiktok" ? "aspect-[9/16] max-h-[640px]" : "aspect-video";

    return (
      <div className={`relative w-full overflow-hidden rounded-xl bg-black ${aspectClass}`}>
        <iframe
          src={embed.embedUrl}
          title={title}
          loading={eager ? "eager" : "lazy"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
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
