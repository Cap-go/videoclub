import { Link } from "react-router-dom";

export function About() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-[#111] sm:text-5xl">About</h1>
        <p className="text-lg text-[#6b7280]">A public board for founders who show up on camera.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">▶</div>
          <p className="mt-2 text-sm font-medium text-[#111]">You on camera</p>
          <p className="mt-1 text-xs text-[#6b7280]">The crowd decides if it&apos;s legit</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">#1</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Rank = videos</p>
          <p className="mt-1 text-xs text-[#6b7280]">Tie? Oldest video wins</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">3</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Public challenges</p>
          <p className="mt-1 text-xs text-[#6b7280]">Then you&apos;re off the board</p>
        </div>
      </div>

      <section className="space-y-4 leading-relaxed text-[#374151]">
        <p>
          Video Club is a public leaderboard. Paste a founder video URL, put your product link in the
          description, and you&apos;re on the board. Rank is how many videos you&apos;ve posted. Same count —
          whoever posted their oldest video first sits higher.
        </p>
        <p>
          Want to know <em>why</em> we built it that way? Read the manifesto — that&apos;s the soul of this
          site.
        </p>
      </section>

      <Link
        to="/manifesto"
        className="inline-flex items-center gap-2 rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] px-5 py-4 text-lg font-semibold text-[#111] transition hover:bg-[#ffe8df]"
      >
        Read the manifesto
        <span className="text-[#f4623a]">→</span>
      </Link>
    </article>
  );
}
