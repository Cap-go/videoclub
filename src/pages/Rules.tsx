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
          higher rank. Tie-break: whoever got on the board first wins the higher spot.
        </p>
        <p className="leading-relaxed text-[#374151]">
          Out-publish everyone to rank #1 — that&apos;s it. Posting fewer than #1 still puts you on the board
          at whatever place that count can take.
        </p>
        <p className="leading-relaxed text-[#374151]">
          <strong>All-time</strong> is the main board — every valid video counts, including old ones.
          <strong> Today</strong> only counts videos published in the last 24 hours (so dumping 200 old
          videos doesn&apos;t bury someone who actually posted fresh content today).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Founder on camera — not identity verification</h2>
        <p className="leading-relaxed text-[#374151]">
          We check that a <strong>person is visible</strong> in the video thumbnail — you on camera, not a
          product demo or screen recording. We cannot prove who you are from a URL. No selfie KYC, no login,
          no OAuth.
        </p>
        <p className="leading-relaxed text-[#374151]">
          First time your startup joins the board, we ask for your <strong>founder name</strong>. We softly
          check whether it appears in the video title, channel, or description. If it doesn&apos;t match, we
          still accept the video and show a small &quot;name not on the video&quot; note — we do not block.
          The product link in the description is still the hard gate.
        </p>
        <p className="leading-relaxed text-[#374151]">
          We do <strong>not</strong> auto-ban with AI-detection models — too many false positives. Community
          reports are the kill switch for AI videos and fake-founder listings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Old videos count</h2>
        <p className="leading-relaxed text-[#374151]">
          No recency requirement on All-time. A video from 2019 is valid if the description{" "}
          <em>currently</em> contains your product URL. Edit an old description, add the link, submit it.
          We show the real publish date when we can — the board stays honest about age — but we never score
          by age.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Same video never counts twice</h2>
        <p className="leading-relaxed text-[#374151]">
          We dedupe by platform video id, not the URL you paste.{" "}
          <code className="rounded bg-[#f3f4f6] px-1">youtube.com/watch?v=X</code>,{" "}
          <code className="rounded bg-[#f3f4f6] px-1">youtu.be/X</code>, Shorts, and{" "}
          <code className="rounded bg-[#f3f4f6] px-1">?si=</code> tracking junk are one video. Same for
          TikTok ids and Instagram shortcodes.
        </p>
        <p className="leading-relaxed text-[#374151]">
          Submit the same video twice? Rejected — even from a different person, even with a different product
          URL. Attribution is locked to whatever product link is in <em>that</em> video&apos;s description.
          You can&apos;t steal someone else&apos;s clip onto your startup.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">What&apos;s fair</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[#374151]">
          <li>Dump your back catalog. That&apos;s the point.</li>
          <li>
            Same talk on YouTube <em>and</em> TikTok <em>and</em> Instagram = 3 videos. Different platforms,
            different posts.
          </li>
          <li>Add your product link to an old description, then submit. Allowed.</li>
          <li>~20 submits per hour per IP — enough to batch-upload, not enough to spam the planet.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">What we don&apos;t do</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[#374151]">
          <li>No video fingerprinting or perceptual hash. Re-uploads as a new id are allowed — reports are the escape hatch.</li>
          <li>No NLP &quot;is this really about your product?&quot; gate. Product link in the description is enough.</li>
          <li>No blocking old videos. No score decay. No minimum duration.</li>
          <li>No accounts. No login. No ads. No API keys.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#111]">Reports & email</h2>
        <p className="leading-relaxed text-[#374151]">
          Anyone can report a video. Pick a reason: <strong>AI video</strong>,{" "}
          <strong>Not the founder</strong>, <strong>No product link</strong>, or <strong>Other</strong>. One
          report removes that video <em>and</em> the entire startup from the board. Founder gets emailed.
        </p>
        <p className="leading-relaxed text-[#374151]">
          First time your startup hits the board? Email and founder name required once. Rank moves on All-time?
          Email. Removed? Email.
        </p>
      </section>
    </article>
  );
}
