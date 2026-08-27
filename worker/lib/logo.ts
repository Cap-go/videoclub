import { proxiedFetch, type ProxiedFetchBindings } from "./proxied-fetch";

const LINK_TAG_RE = /<link\b([^>]*?)>/gi;
const FETCH_TIMEOUT_MS = 5000;

export const WELL_KNOWN_ICON_PATHS = [
  "/apple-touch-icon.png",
  "/apple-touch-icon-180x180.png",
  "/apple-touch-icon-precomposed.png",
] as const;

const PREFERRED_SIZES = [180, 192, 256, 512];

export interface IconCandidate {
  url: string;
  rel: string;
  sizes: number | null;
}

export interface LogoBytes {
  bytes: ArrayBuffer | Uint8Array | string;
  contentType: string;
}

function parseAttributes(attrString: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    const key = match[1]!.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    const existing = attrs.get(key);
    attrs.set(key, existing ? `${existing} ${value}` : value);
  }
  return attrs;
}

function toAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function isIconRel(rel: string): boolean {
  const parts = rel.toLowerCase().split(/\s+/);
  return parts.some(
    (part) =>
      part === "icon" ||
      part === "shortcut" ||
      part === "apple-touch-icon" ||
      part === "apple-touch-icon-precomposed",
  );
}

export function parseSizesAttr(sizes: string | undefined): number | null {
  if (!sizes || sizes === "any") return null;
  let max = 0;
  for (const part of sizes.split(/\s+/)) {
    const match = part.match(/^(\d+)x(\d+)$/i);
    if (!match) continue;
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      max = Math.max(max, w, h);
    }
  }
  return max > 0 ? max : null;
}

export function iconCandidateScore(rel: string, size: number | null): number {
  const relLower = rel.toLowerCase();
  let score = 0;

  if (relLower.includes("apple-touch")) score += 10_000;
  else if (relLower.includes("icon")) score += 1_000;

  const effectiveSize =
    size ?? (relLower.includes("apple-touch") ? 180 : relLower.includes("icon") ? 32 : 0);

  if (effectiveSize > 0 && effectiveSize < 32) return -1;
  if (effectiveSize >= 128) score += effectiveSize;

  for (const preferred of PREFERRED_SIZES) {
    if (effectiveSize === preferred) {
      score += 256 - Math.abs(preferred - 200);
      break;
    }
  }

  if (effectiveSize >= 48 && effectiveSize < 128) score += effectiveSize * 0.5;

  return score;
}

export function collectIconCandidates(html: string, origin: string): IconCandidate[] {
  const candidates: IconCandidate[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(LINK_TAG_RE)) {
    const attrs = parseAttributes(match[1] ?? "");
    const rel = attrs.get("rel") ?? "";
    if (!isIconRel(rel)) continue;

    const href = attrs.get("href");
    if (!href) continue;

    const absolute = toAbsoluteUrl(href, origin);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);

    candidates.push({
      url: absolute,
      rel,
      sizes: parseSizesAttr(attrs.get("sizes")),
    });
  }

  for (const path of WELL_KNOWN_ICON_PATHS) {
    const url = `${origin}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push({
      url,
      rel: "apple-touch-icon",
      sizes: 180,
    });
  }

  return candidates;
}

export function pickBestIconCandidate(candidates: IconCandidate[]): IconCandidate | null {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: iconCandidateScore(candidate.rel, candidate.sizes) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.candidate ?? null;
}

export function pickBestIconFromHtml(html: string, origin: string): IconCandidate | null {
  return pickBestIconCandidate(collectIconCandidates(html, origin));
}

export function googleFaviconUrl(host: string, size: 128 | 256 = 256): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

export function duckDuckGoIconUrl(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function letterFallbackSvg(host: string): string {
  const letter = (host.replace(/^www\./, "").charAt(0) || "?").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${letter}">
  <rect width="64" height="64" rx="12" fill="#f4623a"/>
  <text x="32" y="32" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="700">${letter}</text>
</svg>`;
}

function isTinyIco(contentType: string, bytes: ArrayBuffer): boolean {
  const type = contentType.toLowerCase();
  if (!type.includes("icon") && !type.includes("x-icon")) return false;
  return bytes.byteLength < 500;
}

async function isValidIconResponse(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return false;
  return true;
}

async function readIconResponse(response: Response): Promise<LogoBytes | null> {
  if (!(await isValidIconResponse(response))) return null;
  const bytes = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/png";
  if (isTinyIco(contentType, bytes)) return null;
  return { bytes, contentType };
}

async function fetchIconDirect(url: string): Promise<LogoBytes | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return readIconResponse(response);
  } catch {
    return null;
  }
}

async function fetchIconViaProxy(
  url: string,
  bindings: ProxiedFetchBindings,
): Promise<LogoBytes | null> {
  try {
    const { response } = await proxiedFetch(url, bindings, {
      init: {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "image/*,*/*" },
      },
    });
    return readIconResponse(response);
  } catch {
    return null;
  }
}

export function sortIconCandidates(candidates: IconCandidate[]): IconCandidate[] {
  return [...candidates]
    .map((candidate) => ({ candidate, score: iconCandidateScore(candidate.rel, candidate.sizes) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}

export async function trySiteIcons(
  host: string,
  bindings: ProxiedFetchBindings,
): Promise<LogoBytes | null> {
  const origin = `https://${host}`;

  let html = "";
  try {
    const { response } = await proxiedFetch(origin, bindings, {
      init: {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "text/html,application/xhtml+xml" },
      },
    });
    if (response.ok) {
      html = await response.text();
    }
  } catch {
    // fall through to well-known paths
  }

  const candidates = html
    ? sortIconCandidates(collectIconCandidates(html, origin))
    : WELL_KNOWN_ICON_PATHS.map((path) => ({
        url: `${origin}${path}`,
        rel: "apple-touch-icon",
        sizes: 180,
      }));

  for (const candidate of candidates) {
    const icon = await fetchIconViaProxy(candidate.url, bindings);
    if (icon) return icon;
  }

  return null;
}

export async function fetchStartupLogo(
  host: string,
  bindings: ProxiedFetchBindings,
): Promise<LogoBytes> {
  const siteIcon = await trySiteIcons(host, bindings);
  if (siteIcon) return siteIcon;

  const googleIcon = await fetchIconDirect(googleFaviconUrl(host, 256));
  if (googleIcon) return googleIcon;

  const google128 = await fetchIconDirect(googleFaviconUrl(host, 128));
  if (google128) return google128;

  const duckIcon = await fetchIconDirect(duckDuckGoIconUrl(host));
  if (duckIcon) return duckIcon;

  return {
    bytes: letterFallbackSvg(host),
    contentType: "image/svg+xml; charset=utf-8",
  };
}
