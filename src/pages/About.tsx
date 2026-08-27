export function About() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-[#111] sm:text-5xl">About</h1>
        <p className="text-lg text-[#6b7280]">Why Video Club exists.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">▶</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Founder on camera</p>
          <p className="mt-1 text-xs text-[#6b7280]">Not AI slop</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">#1</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Rank = videos</p>
          <p className="mt-1 text-xs text-[#6b7280]">Nothing else</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">0</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Logins required</p>
          <p className="mt-1 text-xs text-[#6b7280]">Paste and post</p>
        </div>
      </div>

      <section className="space-y-4 leading-relaxed text-[#374151]">
        <p>
          The internet is drowning in AI-generated content. Perfect scripts. Fake faces. Zero soul. You can
          feel when someone actually built the thing they&apos;re talking about.
        </p>
        <p>
          Video Club is a public leaderboard. Rank is simple: how many real founder videos you post about your
          product. Not money. Not vibes. <strong>Videos.</strong>
        </p>
        <p>
          Put your product link in the description. Show your face. Post again. Climb the board. Out-publish
          everyone to rank #1 — that&apos;s it.
        </p>
      </section>

      <blockquote className="rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] px-5 py-4 text-lg font-semibold text-[#111]">
        Rank is the videos — nothing else. Real founder. Real product link. No AI.
      </blockquote>
    </article>
  );
}
