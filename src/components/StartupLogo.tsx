import { useEffect, useState } from "react";
import { faviconFallbackUrl, faviconUrl } from "../lib/api";

interface StartupLogoProps {
  host: string;
  className?: string;
}

export function StartupLogo({ host, className }: StartupLogoProps) {
  const [src, setSrc] = useState(() => faviconUrl(host));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(faviconUrl(host));
    setFailed(false);
  }, [host]);

  if (failed) {
    const letter = (host.replace(/^www\./, "").charAt(0) || "?").toUpperCase();
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl border border-[#e8e4df] bg-[#f4623a] text-sm font-bold text-white ${className ?? ""}`}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => {
        if (src === faviconUrl(host)) {
          setSrc(faviconFallbackUrl(host));
          return;
        }
        setFailed(true);
      }}
    />
  );
}
