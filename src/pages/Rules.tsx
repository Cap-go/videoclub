export function Rules() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-[#111] sm:text-5xl">Rules</h1>
        <p className="text-lg text-[#6b7280]">Blunt version. Read it once.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">How ranking works</h2>
        <p className="leading-relaxed text-[#374151]">
          <strong>Rank is the videos — nothing else.</strong> More valid founder videos about your product =
          higher rank. Tie-break: whoever posted their first video earlier keeps the higher spot.
        </p>
        <p className="leading-relaxed text-[#374151]">
          Out-publish everyone to rank #1 — that&apos;s it. Posting fewer than #1 still puts you on the board
          at whatever place that count can take.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">What you can post</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[#374151]">
          <li>YouTube, TikTok, or Instagram video URLs only</li>
          <li>Founder on camera — human, not AI slop</li>
          <li>Product URL in the video description (not YouTube/TikTok/Instagram links)</li>
        </ul>
        <p className="leading-relaxed text-[#374151]">
          No product link in the description? Rejected. We can&apos;t read the description? Rejected.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Email</h2>
        <p className="leading-relaxed text-[#374151]">
          First time a new startup (product domain) hits the board, we need your email. More videos for the
          same startup? No email again.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Reports</h2>
        <p className="leading-relaxed text-[#374151]">
          Anyone can report a video as AI. <strong>One report removes that video and the entire startup</strong>{" "}
          from the board. The founder gets emailed why.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">After you post</h2>
        <p className="leading-relaxed text-[#374151]">
          Rank changes? You get an email. First time on the board? Welcome email with your rank. Removed?
          Email with the reported video.
        </p>
        <p className="leading-relaxed text-[#374151]">No ads. No API keys. No login.</p>
      </section>
    </article>
  );
}
