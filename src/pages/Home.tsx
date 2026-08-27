import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getPrefilledEmail, HowItWorksModal } from "../components/HowItWorksModal";
import { LivePill } from "../components/LivePill";
import { LiveVisitors } from "../components/LiveVisitors";
import { RankCard } from "../components/RankCard";
import {
  challengeVideo,
  checkVideo,
  getLeaderboard,
  getStartupVideos,
  submitVideo,
  type BoardPeriod,
  type ChallengeReason,
  type LeaderboardEntry,
  type StartupVideo,
} from "../lib/api";

const CHECK_DEBOUNCE_MS = 500;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function Home() {
  const { period } = useOutletContext<{ period: BoardPeriod }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedVideos, setExpandedVideos] = useState<StartupVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [email, setEmail] = useState(() => getPrefilledEmail());
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [modalEmail, setModalEmail] = useState(() => getPrefilledEmail());
  const [productFound, setProductFound] = useState(false);
  const [emailRequired, setEmailRequired] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [foreignAccountWarning, setForeignAccountWarning] = useState<string | null>(null);

  const resetCheckState = useCallback(() => {
    setProductFound(false);
    setEmailRequired(false);
    setProductPreview(null);
    setFormError(null);
    setForeignAccountWarning(null);
  }, []);

  const canPost = useMemo(() => {
    const url = videoUrl.trim();
    if (!url || checking || submitting || !productFound) return false;
    if (emailRequired && !isValidEmail(email)) return false;
    return true;
  }, [videoUrl, checking, submitting, productFound, emailRequired, email]);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(period);
      setEntries(data.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const closeHowItWorks = useCallback((savedEmail?: string) => {
    setHowItWorksOpen(false);
    if (savedEmail) {
      setEmail(savedEmail);
      setModalEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    const url = videoUrl.trim();
    if (!url) {
      setChecking(false);
      resetCheckState();
      return;
    }

    setProductFound(false);
    setEmailRequired(false);
    setProductPreview(null);
    setFormError(null);
    setForeignAccountWarning(null);
    setChecking(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await checkVideo(url);
          if (result.error || !result.productFound) {
            setFormError(result.error ?? "No product link found in the video description.");
            setProductFound(false);
            setEmailRequired(false);
            setProductPreview(null);
            return;
          }
          setFormError(null);
          setProductFound(true);
          setEmailRequired(result.emailRequired);
          setProductPreview(result.productUrl ?? null);
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Check failed");
          setProductFound(false);
          setEmailRequired(false);
          setProductPreview(null);
        } finally {
          setChecking(false);
        }
      })();
    }, CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [videoUrl, resetCheckState]);

  const totalVideos = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.video_count, 0),
    [entries],
  );

  const claimTarget = entries[0]?.video_count ? entries[0].video_count + 1 : 1;

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

  const handleSubmit = async (e: React.FormEvent, force = false) => {
    e.preventDefault();
    if (!canPost && !force) return;
    setFormError(null);
    setFormSuccess(null);
    if (!force) setForeignAccountWarning(null);
    setSubmitting(true);
    try {
      const result = await submitVideo(videoUrl.trim(), email.trim() || undefined, { force });
      setFormSuccess(
        `Posted "${result.video.title}" — ${result.startup.name} is now #${result.startup.rank}`,
      );
      setVideoUrl("");
      setEmail("");
      resetCheckState();
      await loadBoard();
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      const message = apiErr.message ?? "Submit failed";
      if (apiErr.code === "FOREIGN_ACCOUNT") {
        setForeignAccountWarning(message);
        setFormError(null);
      } else {
        setFormError(message);
        setForeignAccountWarning(null);
        if (message.includes("Email is required")) setEmailRequired(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
        setExpandedId(null);
        setExpandedVideos([]);
      } else if (expandedId) {
        const data = await getStartupVideos(expandedId);
        setExpandedVideos(data.videos);
      }
      await loadBoard();
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Challenge failed");
    }
  };

  return (
    <div className="space-y-10">
      <HowItWorksModal
        open={howItWorksOpen}
        email={modalEmail}
        onEmailChange={setModalEmail}
        onClose={closeHowItWorks}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <LivePill startupCount={entries.length} videoCount={totalVideos} />
        <LiveVisitors />
      </div>

      <section className="mx-auto max-w-4xl space-y-4 pt-2 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#111] sm:text-5xl md:text-6xl">
          Claim #1 with{" "}
          <span className="text-[#f4623a]">{claimTarget} video{claimTarget === 1 ? "" : "s"}</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base text-[#6b7280] sm:text-lg">
          Out-publish everyone to rank #1 — that&apos;s it. Posting fewer than #1 still puts you on the board
          at whatever place that count can take.
        </p>
        <p className="text-sm text-[#9ca3af]">No ads. No API keys. No login.</p>
      </section>

      <section className="mx-auto max-w-4xl">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]">
              ▶
            </span>
            <input
              id="videoUrl"
              type="url"
              placeholder="Paste YouTube, TikTok, Instagram, or X URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-2xl border border-[#e8e4df] bg-white py-3.5 pl-10 pr-12 text-[#111] outline-none transition focus:border-[#f4623a] focus:ring-2 focus:ring-[#f4623a]/20"
            />
            <button
              type="button"
              onClick={() => {
                setModalEmail(email);
                setHowItWorksOpen(true);
              }}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#e8e4df] bg-[#faf8f5] text-xs font-semibold text-[#6b7280] transition hover:border-[#f4623a] hover:text-[#f4623a]"
              aria-label="How it works"
            >
              i
            </button>
          </div>

          {emailRequired && productFound && (
            <div className="space-y-1">
              <input
                id="email"
                type="email"
                required
                placeholder="Email for rank updates"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[#e8e4df] bg-white px-4 py-3.5 text-[#111] outline-none transition focus:border-[#f4623a] focus:ring-2 focus:ring-[#f4623a]/20"
              />
              <p className="text-center text-sm text-[#6b7280] sm:text-left">
                First time this startup is on the board — we need an email for rank updates.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canPost}
            className="w-full rounded-2xl bg-[#f4623a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#e8573a] disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Posting…" : "Post"}
          </button>

          {productPreview && (
            <p className="text-center text-sm text-[#6b7280]">
              Product in description:{" "}
              <a
                href={productPreview}
                className="font-medium text-[#f4623a] hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {productPreview}
              </a>
            </p>
          )}

          {checking && <p className="text-center text-sm text-[#9ca3af]">Reading video description…</p>}
          {foreignAccountWarning && (
            <div className="rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] p-4 text-center">
              <p className="text-sm leading-relaxed text-[#374151]">{foreignAccountWarning}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setForeignAccountWarning(null)}
                  className="rounded-xl border border-[#e8e4df] bg-white px-4 py-2 text-sm font-medium text-[#111] transition hover:bg-[#faf8f5]"
                >
                  Go back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => void handleSubmit(e, true)}
                  className="rounded-xl border border-[#f4623a] bg-white px-4 py-2 text-sm font-medium text-[#f4623a] transition hover:bg-[#fff9f7] disabled:opacity-50"
                >
                  These are both my accounts — force
                </button>
              </div>
            </div>
          )}
          {formError && <p className="text-center text-sm text-[#dc2626]">{formError}</p>}
          {formSuccess && <p className="text-center text-sm font-medium text-[#059669]">{formSuccess}</p>}
        </form>
      </section>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-2xl border border-[#e8e4df] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">How it works</p>
            <ul className="mt-3 space-y-2 text-sm text-[#6b7280]">
              <li>Paste a founder video URL</li>
              <li>Product link must be in the description</li>
              <li>Old videos count on All-time — dump your back catalog</li>
              <li>Same video id never counts twice</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] p-4">
            <p className="text-sm font-semibold text-[#111]">Rank is the videos — nothing else.</p>
            <p className="mt-2 text-sm text-[#6b7280]">
              Legitimacy is crowd-judged. Challenge fake videos — three challenges removes a startup.
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#111]">Leaderboard</h2>
              <p className="mt-1 text-sm text-[#9ca3af]">
                {period === "today"
                  ? "Videos published in the last 24h (or submitted today if publish date unknown)."
                  : "Every valid video counts — including your back catalog."}
              </p>
            </div>
            {!loading && entries.length > 0 && (
              <span className="text-sm text-[#9ca3af]">{entries.length} on the board</span>
            )}
          </div>

          {loading ? (
            <p className="text-[#6b7280]">Loading…</p>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e8e4df] bg-white p-10 text-center">
              <p className="text-lg font-semibold text-[#111]">Be the first on the board.</p>
              <p className="mt-2 text-sm text-[#6b7280]">
                Post one video with your product link in the description. You&apos;re #1.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <RankCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  videosLoading={videosLoading}
                  videos={expandedId === entry.id ? expandedVideos : []}
                  onToggle={() => void toggleRow(entry)}
                  onChallenge={(id, reason) => void handleChallenge(id, reason)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
