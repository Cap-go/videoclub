import { browserFetch, BROWSER_USER_AGENT } from "./browser-fetch";

export const DIRECT_USER_AGENT =
  "Mozilla/5.0 (compatible; VideoClubBot/1.0; +https://videoclub.lol)";

export type FetchLayer = "direct" | "proxy" | "browser";

export interface ProxiedFetchBindings {
  PROXY_URL?: string;
  BROWSER?: BrowserRun;
}

export interface ProxiedFetchOptions {
  init?: RequestInit;
  /** When true, skip direct fetch and use proxy/browser immediately. */
  forceProxy?: boolean;
}

export interface ProxiedFetchOutcome {
  response: Response;
  layer: FetchLayer;
  blocked: boolean;
}

export function redactUrlForLogs(url: string): string {
  return url.replace(/\/\/[^@/]+@/g, "//[REDACTED]@");
}

export function redactSecretsInText(text: string, secrets: Array<string | undefined>): string {
  let redacted = text;
  for (const secret of secrets) {
    if (!secret) continue;
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

export function isHttpBlocked(status: number): boolean {
  return status === 429 || status === 403;
}

export function isInnertubeBlockedPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const playability = (data as Record<string, unknown>).playabilityStatus as
    | Record<string, unknown>
    | undefined;
  if (!playability) return false;
  const status = playability.status;
  if (status === "LOGIN_REQUIRED" || status === "UNPLAYABLE") return true;
  const reasons = playability.reason;
  if (typeof reasons === "string" && /login|sign in|bot/i.test(reasons)) return true;
  return false;
}

export function isHtmlBlocked(html: string): boolean {
  if (!html) return false;
  return (
    /consent\.youtube\.com/i.test(html) ||
    /Before you continue to YouTube/i.test(html) ||
    /LOGIN_REQUIRED/i.test(html) ||
    /g-recaptcha/i.test(html) ||
    /challenge-platform/i.test(html)
  );
}

function isRelayProxyUrl(proxyUrl: string): boolean {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.searchParams.has("url")) return true;
    if (proxyUrl.includes("?url=")) return true;
    // host:port style proxies use userinfo + no path/query
    return !(parsed.username && parsed.password && !parsed.pathname.replace("/", ""));
  } catch {
    return true;
  }
}

function buildRelayProxyUrl(proxyBase: string, targetUrl: string): string {
  if (proxyBase.includes("?url=") || proxyBase.endsWith("?url=") || proxyBase.endsWith("&url=")) {
    return `${proxyBase}${encodeURIComponent(targetUrl)}`;
  }
  try {
    const parsed = new URL(proxyBase);
    parsed.searchParams.set("url", targetUrl);
    return parsed.toString();
  } catch {
    const joiner = proxyBase.includes("?") ? "&" : "?";
    return `${proxyBase}${joiner}url=${encodeURIComponent(targetUrl)}`;
  }
}

async function fetchViaProxyRelay(
  proxyBase: string,
  targetUrl: string,
  init: RequestInit,
): Promise<Response> {
  const relayUrl = buildRelayProxyUrl(proxyBase, targetUrl);
  return fetch(relayUrl, {
    ...init,
    headers: {
      ...spreadHeaders(init.headers),
      "User-Agent": BROWSER_USER_AGENT,
    },
  });
}

function spreadHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function toResponse(result: { status: number; body: string; contentType?: string | null }): Response {
  const responseHeaders = new Headers();
  if (result.contentType) responseHeaders.set("content-type", result.contentType);
  return new Response(result.body, { status: result.status, headers: responseHeaders });
}

async function fetchViaProxyLayer(
  bindings: ProxiedFetchBindings,
  targetUrl: string,
  init: RequestInit,
): Promise<{ response: Response; layer: FetchLayer } | null> {
  if (bindings.PROXY_URL) {
    if (isRelayProxyUrl(bindings.PROXY_URL)) {
      return {
        response: await fetchViaProxyRelay(bindings.PROXY_URL, targetUrl, init),
        layer: "proxy",
      };
    }
    console.warn(
      "PROXY_URL looks like host:port credentials; use a fetch-relay (?url=) — CONNECT proxies are not supported on Workers.",
    );
    return null;
  }

  if (bindings.BROWSER) {
    const result = await browserFetch(bindings.BROWSER, targetUrl, {
      ...init,
      headers: {
        ...spreadHeaders(init.headers),
        "User-Agent": BROWSER_USER_AGENT,
      },
    });
    return { response: toResponse(result), layer: "browser" };
  }

  return null;
}

async function readBodySnippet(response: Response, max = 4096): Promise<string> {
  try {
    const text = await response.clone().text();
    return text.slice(0, max);
  } catch {
    return "";
  }
}

export async function isResponseBlocked(
  response: Response,
  options?: { expectJson?: boolean; requireBody?: boolean },
): Promise<boolean> {
  if (isHttpBlocked(response.status)) return true;
  if (!response.ok && response.status >= 400) return true;

  const snippet = await readBodySnippet(response);
  if (!snippet) return options?.requireBody === true;

  if (options?.expectJson) {
    try {
      const data = JSON.parse(snippet) as unknown;
      if (isInnertubeBlockedPayload(data)) return true;
    } catch {
      /* not JSON */
    }
  }

  if (isHtmlBlocked(snippet)) return true;
  return false;
}

/** Single outbound path: direct first, then one proxy/browser retry when blocked. */
export async function proxiedFetch(
  targetUrl: string,
  bindings: ProxiedFetchBindings,
  options: ProxiedFetchOptions = {},
): Promise<ProxiedFetchOutcome> {
  const init: RequestInit = {
    redirect: "follow",
    ...options.init,
    headers: {
      Accept: "application/json, text/html, */*",
      "User-Agent": DIRECT_USER_AGENT,
      ...spreadHeaders(options.init?.headers),
    },
  };

  if (!options.forceProxy) {
    const direct = await fetch(targetUrl, init);
    const blocked = await isResponseBlocked(direct, {
      expectJson: init.method === "POST",
      requireBody: init.method === "POST",
    });
    if (!blocked) {
      return { response: direct, layer: "direct", blocked: false };
    }

    const proxyAttempt = await fetchViaProxyLayer(bindings, targetUrl, init);
    if (proxyAttempt) {
      return { response: proxyAttempt.response, layer: proxyAttempt.layer, blocked: true };
    }
    return { response: direct, layer: "direct", blocked: true };
  }

  const proxyAttempt = await fetchViaProxyLayer(bindings, targetUrl, init);
  if (proxyAttempt) {
    return { response: proxyAttempt.response, layer: proxyAttempt.layer, blocked: true };
  }

  const fallback = await fetch(targetUrl, init);
  return { response: fallback, layer: "direct", blocked: true };
}
