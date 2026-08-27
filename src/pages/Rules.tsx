export function Rules() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-[#111] sm:text-5xl">Rules</h1>
        <p className="text-lg font-semibold text-[#111]">
          Rank is the video count. Same count: the startup whose oldest video is older sits higher. Several
          videos — we use the oldest one.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">What counts</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[#374151]">
          <li>YouTube, TikTok, Instagram, X. Old videos are fine.</li>
          <li>
            The product link must be in the description. That is how we know who the video is for.
          </li>
          <li>
            Same video never counts twice (<code className="rounded bg-[#f3f4f6] px-1">youtu.be</code> and{" "}
            <code className="rounded bg-[#f3f4f6] px-1">youtube.com/watch</code> are one video). Same talk on
            two platforms is two videos.
          </li>
          <li>First time your startup hits the board, we take an email so we can tell you when rank changes.</li>
          <li>
            Same video count? Older oldest video wins. Publish date when we have it; submit time if we
            don&apos;t.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">What does not count, and who decides</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[#374151]">
          <li>We do not run an AI detector. We do not check your passport. We do not decide if that is really the founder.</li>
          <li>
            You do. If a video looks AI, or it is not the founder, challenge it. Give a reason. Challenges are
            public.
          </li>
          <li>
            Three challenges on one video and that video is gone, and the startup is gone with it. We email the
            founder.
          </li>
          <li>
            One IP address cannot challenge the same video twice. Three distinct challenges from different
            people remove the startup.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">One account per platform</h2>
        <p className="leading-relaxed text-[#374151]">
          Each domain gets one YouTube account, one TikTok account, one Instagram account, and one X account. Affiliates
          cannot post for your startup. If you legitimately have two accounts on the same platform, you can
          force the submit — we get an email and review it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">All-time vs Today</h2>
        <p className="leading-relaxed text-[#374151]">
          <strong>All-time</strong> counts every valid video, including your back catalog.{" "}
          <strong>Today</strong> only counts videos published in the last 24 hours (or submitted today if we
          cannot read the publish date). Tie on count? Oldest among those counted videos wins — on Today,
          that means oldest among today&apos;s videos only.
        </p>
      </section>

      <blockquote className="rounded-2xl border border-[#fcd4c4] bg-[#fff9f7] px-5 py-4 text-lg font-semibold leading-relaxed text-[#111]">
        That is the whole game. Post real videos of yourself talking about the product. If you fake it, people
        will take you off the board.
      </blockquote>
    </article>
  );
}
