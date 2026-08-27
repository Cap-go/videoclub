import type { MouseEvent } from "react";
import { recordStartupClick } from "../lib/stats";

const productDomainLinkClass =
  "font-medium text-[#f4623a] underline underline-offset-2 decoration-[#f4623a]/70 hover:decoration-[#f4623a]";

interface ProductDomainLinkProps {
  href: string;
  host: string;
  startupId: number;
  onClickRecorded?: (clickCount: number, totalClicks: number) => void;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

export function ProductDomainLink({
  href,
  host,
  startupId,
  onClickRecorded,
  onClick,
  className = productDomainLinkClass,
}: ProductDomainLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    onClick?.(event);
    void recordStartupClick(startupId).then((result) => {
      if (result) onClickRecorded?.(result.click_count, result.total_clicks);
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className={className}
    >
      {host}
    </a>
  );
}
