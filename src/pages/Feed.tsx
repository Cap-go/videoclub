import { useCallback, useEffect, useRef, useState } from "react";
import {
  challengeVideo,
  getFeed,
  type ChallengeReason,
  type FeedVideo,
} from "../lib/api";
import { FeedCard } from "../components/FeedCard";

export function Feed() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  const loadFeed = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await getFeed(cursor);
      setVideos((prev) => (cursor ? [...prev, ...data.videos] : data.videos));
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
      if (!cursor) setVideos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (loading || scrolledRef.current) return;

    const hash = window.location.hash;
    if (!hash.startsWith("#video-")) return;

    const id = hash.slice("#video-".length);
    const el = document.getElementById(`video-${id}`);
    if (!el) return;

    scrolledRef.current = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-[#f4623a]", "ring-offset-2");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-[#f4623a]", "ring-offset-2");
      }, 2000);
    });
  }, [loading, videos]);

  const handleChallenge = async (videoId: number, reason: ChallengeReason) => {
    const labels: Record<ChallengeReason, string> = {
      ai: "AI video",
      not_founder: "Not the founder",
      not_real_product: "Not a real product",
    };
    if (
      !confirm(
        `Challenge as "${labels[reason]}"? Challenges are public. Three distinct challenges removes the video and startup.`,
      )
    ) {
      return;
    }

    try {
      const result = await challengeVideo(videoId, reason);
      if (result.removed) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
      } else {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, challenge_count: result.challengeCount } : v,
          ),
        );
      }
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Challenge failed");
    }
  };

  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-3xl space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[#111] sm:text-4xl">Video feed</h1>
        <p className="text-base text-[#6b7280] sm:text-lg">
          Every founder video on the board — newest first. Challenge anything that doesn&apos;t belong.
        </p>
      </section>

      {loading ? (
        <p className="text-center text-[#6b7280]">Loading feed…</p>
      ) : error ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6 text-center text-sm text-[#dc2626]">
          {error}
        </div>
      ) : videos.length === 0 ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[#e8e4df] bg-white p-10 text-center">
          <p className="text-lg font-semibold text-[#111]">No videos yet.</p>
          <p className="mt-2 text-sm text-[#6b7280]">
            Post the first founder video on the leaderboard to fill the feed.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-6">
          {videos.map((video, index) => (
            <FeedCard
              key={video.id}
              video={video}
              eagerEmbed={index < 4}
              onChallenge={(id, reason) => void handleChallenge(id, reason)}
            />
          ))}

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadFeed(nextCursor)}
                disabled={loadingMore}
                className="rounded-2xl border border-[#e8e4df] bg-white px-6 py-3 text-sm font-semibold text-[#111] transition hover:border-[#f4623a] hover:text-[#f4623a] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
