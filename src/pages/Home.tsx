import { useCallback, useEffect, useState } from "react";
import {
  checkVideo,
  faviconUrl,
  getLeaderboard,
  getStartupVideos,
  reportVideo,
  submitVideo,
  type LeaderboardEntry,
  type StartupVideo,
} from "../lib/api";

function platformLabel(platform: string) {
  if (platform === "youtube") return "YouTube";
  if (platform === "tiktok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  return platform;
}

export function Home() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedVideos, setExpandedVideos] = useState<StartupVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [emailRequired, setEmailRequired] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setEntries(data.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const toggleRow = async (entry: LeaderboardEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
      setExpandedVideos([]);
      return;
    }
    setExpandedId(entry.id);
    setVideosLoading(true);
    try {
      const data = await getStartupVideos(entry.id);
      setExpandedVideos(data.videos);
    } catch {
      setExpandedVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const handleVideoUrlBlur = async () => {
    const url = videoUrl.trim();
    if (!url) {
      setEmailRequired(false);
      setProductPreview(null);
      return;
    }
    setChecking(true);
    setFormError(null);
    try {
      const result = await checkVideo(url);
      if (result.error) {
        setFormError(result.error);
        setEmailRequired(false);
        setProductPreview(null);
        return;
      }
      setEmailRequired(result.emailRequired);
      setProductPreview(result.productUrl ?? null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      const result = await submitVideo(videoUrl.trim(), email.trim() || undefined);
      setFormSuccess(
        `Added "${result.video.title}" — ${result.startup.name} is now #${result.startup.rank}`,
      );
      setVideoUrl("");
      setEmail("");
      setEmailRequired(false);
      setProductPreview(null);
      await loadBoard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit failed";
      setFormError(message);
      if (message.includes("Email is required")) setEmailRequired(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (videoId: number) => {
    if (!confirm("Report this video as AI? This removes the video AND the entire startup from the board.")) {
      return;
    }
    try {
      await reportVideo(videoId);
      setExpandedId(null);
      setExpandedVideos([]);
      await loadBoard();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Report failed");
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ff3333]">Public leaderboard</p>
        <h1 className="text-5xl font-black leading-none tracking-tight sm:text-7xl">Video Club</h1>
        <p className="max-w-xl text-lg text-[#aaa] sm:text-xl">
          Rank is the videos. Real founder. Real product link. No AI.
        </p>
      </section>

      <section className="rounded-2xl border border-[#222] bg-[#111] p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Submit a founder video</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="videoUrl" className="mb-1 block text-sm text-[#888]">
              Video URL (YouTube, TikTok, Instagram)
            </label>
            <input
              id="videoUrl"
              type="url"
              required
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onBlur={() => void handleVideoUrlBlur()}
              className="w-full rounded-xl border border-[#333] bg-[#0a0a0a] px-4 py-3 outline-none ring-[#ff3333] focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-[#888]">
              Email{" "}
              <span className="text-[#666]">
                {emailRequired
                  ? "(required — first time this startup is added)"
                  : "(optional — only required the first time your startup is added)"}
              </span>
            </label>
            <input
              id="email"
              type="email"
              required={emailRequired}
              placeholder="founder@startup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#333] bg-[#0a0a0a] px-4 py-3 outline-none ring-[#ff3333] focus:ring-2"
            />
          </div>

          {productPreview && (
            <p className="text-sm text-[#888]">
              Product detected:{" "}
              <a href={productPreview} className="text-[#ff6666] underline" target="_blank" rel="noreferrer">
                {productPreview}
              </a>
            </p>
          )}

          {checking && <p className="text-sm text-[#666]">Reading video description…</p>}
          {formError && <p className="text-sm text-[#ff6666]">{formError}</p>}
          {formSuccess && <p className="text-sm text-[#66ff99]">{formSuccess}</p>}

          <button
            type="submit"
            disabled={submitting || checking}
            className="w-full rounded-xl bg-[#ff3333] px-4 py-3 text-base font-bold text-black transition hover:bg-[#ff5555] disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Submitting…" : "Add to the board"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black sm:text-3xl">Leaderboard</h2>
          <span className="text-sm text-[#666]">{entries.length} startups</span>
        </div>

        {loading ? (
          <p className="text-[#666]">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#333] p-8 text-center text-[#666]">
            No startups yet. Be the first founder on camera.
          </p>
        ) : (
          <div className="divide-y divide-[#222] rounded-2xl border border-[#222] bg-[#0a0a0a]">
            {entries.map((entry) => (
              <div key={entry.id}>
                <button
                  type="button"
                  onClick={() => void toggleRow(entry)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[#111] sm:gap-4 sm:px-5"
                >
                  <span className="w-10 shrink-0 text-2xl font-black tabular-nums text-[#ff3333] sm:w-12 sm:text-3xl">
                    #{entry.rank}
                  </span>
                  <img
                    src={faviconUrl(entry.product_host)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg bg-[#222]"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{entry.name}</div>
                    <a
                      href={entry.product_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="truncate text-sm text-[#888] underline-offset-2 hover:text-[#ff6666] hover:underline"
                    >
                      {entry.product_host}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-black tabular-nums sm:text-3xl">{entry.video_count}</div>
                    <div className="text-xs uppercase tracking-wide text-[#666]">videos</div>
                  </div>
                </button>

                {expandedId === entry.id && (
                  <div className="border-t border-[#222] bg-[#111] px-4 py-4 sm:px-5">
                    {videosLoading ? (
                      <p className="text-sm text-[#666]">Loading videos…</p>
                    ) : expandedVideos.length === 0 ? (
                      <p className="text-sm text-[#666]">No videos</p>
                    ) : (
                      <ul className="space-y-3">
                        {expandedVideos.map((video) => (
                          <li
                            key={video.id}
                            className="flex flex-col gap-3 rounded-xl border border-[#222] bg-[#0a0a0a] p-3 sm:flex-row sm:items-center"
                          >
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt=""
                                className="h-20 w-full rounded-lg object-cover sm:h-16 sm:w-28"
                              />
                            ) : (
                              <div className="flex h-20 w-full items-center justify-center rounded-lg bg-[#222] text-2xl sm:h-16 sm:w-28">
                                ▶
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold">{video.title}</div>
                              <div className="text-xs text-[#666]">{platformLabel(video.platform)}</div>
                              <a
                                href={video.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-[#ff6666] underline"
                              >
                                Watch
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleReport(video.id)}
                              className="shrink-0 rounded-lg border border-[#442222] px-3 py-2 text-xs text-[#ff6666] hover:bg-[#221111]"
                            >
                              Report AI
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
