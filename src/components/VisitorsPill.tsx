import { useVisitors } from "../lib/visitors";
import { formatCount } from "../lib/format";

export function VisitorsPill() {
  const counts = useVisitors();

  if (!counts) return null;

  const visitorsLabel = formatCount(counts.visitorsSinceLaunch);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-[#d1fae5] bg-[#ecfdf5] px-4 py-1.5 text-sm text-[#065f46]"
      title={`${visitorsLabel} visitors since launch`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
      </span>
      <span>
        <span className="font-bold text-[#059669]">{formatCount(counts.liveVisitorCount)} online</span>
        <span> · {visitorsLabel} visitors</span>
        {counts.statsShareUrl ? (
          <>
            {" · "}
            <a
              href={counts.statsShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#059669] underline decoration-[#a7f3d0] underline-offset-2 hover:text-[#047857]"
            >
              see stats→
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}
