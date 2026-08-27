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
          <p className="mt-1 text-xs text-[#6b7280]">Nothing else</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4df] bg-white p-4 text-center">
          <div className="text-2xl font-bold text-[#f4623a]">3</div>
          <p className="mt-2 text-sm font-medium text-[#111]">Public challenges</p>
          <p className="mt-1 text-xs text-[#6b7280]">Then you&apos;re off the board</p>
        </div>
      </div>

      <section className="space-y-4 leading-relaxed text-[#374151]">
        <p>
          The feed is full of polished nonsense. Perfect scripts. Fake faces. Zero proof anyone built the thing
          they&apos;re selling. You can usually tell when a real founder is talking about something they made.
        </p>
        <p>
          Video Club is a public leaderboard. Rank is simple: how many videos you post about your product, with
          your product link in the description. Not money. Not vibes. <strong>Videos.</strong>
        </p>
        <p>
          We do not run an AI detector or verify your identity. The crowd does. See something fake? Challenge
          it — publicly. Three distinct challenges on one video and that startup is gone. We email the founder
          so they know what happened.
        </p>
        <p>
          Post real videos of yourself talking about your product. Out-publish everyone to rank #1. If you fake
          it, people will take you off the board.
        </p>
      </section>

      <blockquote className="rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] px-5 py-4 text-lg font-semibold text-[#111]">
        Rank is the video count. The crowd keeps it honest.
      </blockquote>
    </article>
  );
}
