import type { MouseEvent } from "react";

const productDomainLinkClass =
  "font-medium text-[#f4623a] underline underline-offset-2 decoration-[#f4623a]/70 hover:decoration-[#f4623a]";

interface ProductDomainLinkProps {
  href: string;
  host: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

export function ProductDomainLink({
  href,
  host,
  onClick,
  className = productDomainLinkClass,
}: ProductDomainLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick ?? ((event) => event.stopPropagation())}
      className={className}
    >
      {host}
    </a>
  );
}
