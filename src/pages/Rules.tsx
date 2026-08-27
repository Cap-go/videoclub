export function Rules() {
  return (
    <article className="prose prose-invert max-w-none space-y-8">
      <h1 className="text-4xl font-black sm:text-5xl">Rules</h1>
      <p className="text-lg text-[#aaa]">Blunt version. Read it.</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">1. Paste a video URL</h2>
        <p className="text-[#ccc]">
          YouTube, TikTok, or Instagram Reels/posts. That&apos;s it. No accounts. No login. No pitch deck upload.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">2. Product link in the description</h2>
        <p className="text-[#ccc]">
          We read the video description. It must contain a real product URL — http/https that is{" "}
          <strong>not</strong> YouTube, TikTok, or Instagram. That URL attributes the video to your startup.
          No product link? Rejected.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">3. Real founder on camera</h2>
        <p className="text-[#ccc]">
          Human founder. Not AI slop. We can&apos;t detect AI perfectly. Honor system + community reports.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">4. Email once per startup</h2>
        <p className="text-[#ccc]">
          First video for a new product domain? We need your email. More videos for the same startup? No email
          again.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">5. Rank = video count</h2>
        <p className="text-[#ccc]">
          More valid founder videos = higher rank. Tie-break: whoever posted their first video earlier wins the
          higher spot.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">6. One AI report nukes the startup</h2>
        <p className="text-[#ccc]">
          Anyone can report a video as AI. One report removes that video <em>and</em> removes the entire startup
          from the board. The founder gets emailed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#ff3333]">7. Rank changes = email</h2>
        <p className="text-[#ccc]">
          New video moves you up or down? Email. Someone gets removed and everyone shifts? Email.
        </p>
      </section>
    </article>
  );
}
