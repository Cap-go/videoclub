import { Link } from "react-router-dom";

export function Manifesto() {
  return (
    <article className="mx-auto max-w-2xl space-y-16 sm:space-y-20">
      <header className="space-y-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#f4623a]">Manifesto</p>
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#111] sm:text-5xl md:text-6xl">
          Stay human.
        </h1>
        <p className="text-xl leading-relaxed text-[#6b7280] sm:text-2xl">
          Marketing is hard. Making the video yourself is harder. That&apos;s the point.
        </p>
      </header>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#111] sm:text-3xl">The problem</h2>
        <div className="space-y-4 text-lg leading-relaxed text-[#374151] sm:text-xl">
          <p>
            Everyone can generate a perfect ad now. Polished copy. Smooth voiceover. A face that never blinks.
            Nobody believes it anymore.
          </p>
          <p>
            The feed is full of slop. AI pretending to be a person pretending to care about a product they never
            touched. You scroll past it. Your customers scroll past it. We all do.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#111] sm:text-3xl">The harder thing</h2>
        <div className="space-y-4 text-lg leading-relaxed text-[#374151] sm:text-xl">
          <p>
            You. On camera. Talking about what you built.
          </p>
          <p>
            Awkward. Slow. Maybe you stumble over a word. Maybe the lighting is bad. Maybe you look tired
            because you were up until 2am fixing a bug. <em>Good.</em> That&apos;s what real looks like.
          </p>
          <p>
            Making the video yourself is harder than outsourcing it to a tool. That&apos;s not a bug. It keeps
            this human. It shows you care about the product enough to sit down and say something out loud.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#111] sm:text-3xl">Why it matters</h2>
        <div className="space-y-4 text-lg leading-relaxed text-[#374151] sm:text-xl">
          <p>
            Care is visible. A founder who will film themselves talking about what they made is a founder who
            gives a damn. That signal cuts through everything else.
          </p>
          <p>
            The world coming is full of AI slop. A real person on camera — imperfect, honest, a little
            uncomfortable — is how people know you&apos;re not faking it.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#111] sm:text-3xl">What Video Club is</h2>
        <div className="space-y-4 text-lg leading-relaxed text-[#374151] sm:text-xl">
          <p>
            Video Club exists to push founders to post more real videos of themselves. That&apos;s it.
          </p>
          <p>
            Rank is the count. Nothing else. No ads. No algorithm. No pay-to-win. How many videos did you
            actually post about your product? That number is your place on the board.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#111] sm:text-3xl">The rules, in one breath</h2>
        <div className="space-y-4 text-lg leading-relaxed text-[#374151] sm:text-xl">
          <p>
            Put your product link in the video description. Post on YouTube, TikTok, or Instagram. Old videos
            count — dump your back catalog. Same video never counts twice.
          </p>
          <p>
            We don&apos;t run an AI detector. We don&apos;t check your passport. The crowd judges whether
            it&apos;s really you, whether it&apos;s really your product, whether it&apos;s real at all. See
            something fake? Challenge it. Three distinct challenges and you&apos;re off the board.
          </p>
          <p>
            If you fake it, people will take you off the board. That&apos;s the whole enforcement mechanism.
            Public. Simple. Honest.
          </p>
        </div>
      </section>

      <section className="space-y-6 border-t border-[#e8e4df] pt-12 sm:pt-16">
        <blockquote className="text-2xl font-bold leading-snug text-[#111] sm:text-3xl">
          Post the video. That&apos;s the whole club.
        </blockquote>
        <p className="text-lg text-[#6b7280]">
          <Link to="/" className="font-semibold text-[#f4623a] hover:underline">
            Go to the leaderboard
          </Link>
          {" · "}
          <Link to="/rules" className="font-semibold text-[#f4623a] hover:underline">
            Read the full rules
          </Link>
        </p>
      </section>
    </article>
  );
}
