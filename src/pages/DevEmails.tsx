import { useEffect, useState } from "react";
import { getEmailPreviews, type EmailPreview } from "../lib/api";

export function DevEmails() {
  const [previews, setPreviews] = useState<EmailPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getEmailPreviews();
        setPreviews(data.previews);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load previews");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-[#111]">Email previews</h1>
        <p className="text-[#6b7280]">
          Dummy data — welcome, rank change, challenge escalation (1/3 and 2/3), and removal emails.
        </p>
      </header>

      {loading && <p className="text-[#6b7280]">Loading…</p>}
      {error && <p className="text-[#dc2626]">{error}</p>}

      <div className="space-y-10">
        {previews.map((preview) => (
          <section key={preview.id ?? preview.kind} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                {preview.kind.replace("_", " ")}
              </p>
              <h2 className="text-lg font-semibold text-[#111]">{preview.subject}</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e8e4df] bg-white shadow-sm">
              <iframe
                title={preview.subject}
                srcDoc={preview.html}
                className="h-[520px] w-full border-0 bg-[#faf8f5]"
                sandbox=""
              />
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
