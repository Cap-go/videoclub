import type { Env } from "../types";

const DATAFAST_API_BASE = "https://datafa.st/api/v1/analytics";
export const DEFAULT_DATAFAST_WEBSITE_ID = "dfid_wluiJbHWvAdJPGboMTXwb";
const CACHE_TTL_MS = 45_000;

interface CacheEntry {
  value: number;
  expiresAt: number;
}

interface DataFastMetricResponse {
  status?: string;
  data?: Array<{ visitors?: number }>;
  error?: { code?: number; message?: string };
}

let overviewCache: CacheEntry | null = null;
let realtimeCache: CacheEntry | null = null;

export function resetDataFastCache(): void {
  overviewCache = null;
  realtimeCache = null;
}

function resolveWebsiteId(env: Env): string {
  return env.DATAFAST_WEBSITE_ID?.trim() || DEFAULT_DATAFAST_WEBSITE_ID;
}

function isAccountToken(apiKey: string): boolean {
  return apiKey.startsWith("dft_");
}

function buildAnalyticsUrl(path: "overview" | "realtime", env: Env): string {
  const url = new URL(`${DATAFAST_API_BASE}/${path}`);
  url.searchParams.set("fields", "visitors");
  const apiKey = env.DATAFAST_API_KEY?.trim();
  if (apiKey && isAccountToken(apiKey)) {
    url.searchParams.set("websiteId", resolveWebsiteId(env));
  }
  return url.toString();
}

function readCached(entry: CacheEntry | null): number | null {
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

function parseVisitors(body: DataFastMetricResponse): number | null {
  const visitors = body.data?.[0]?.visitors;
  if (typeof visitors !== "number" || !Number.isFinite(visitors)) return null;
  return visitors;
}

async function fetchMetric(
  path: "overview" | "realtime",
  env: Env,
  cache: CacheEntry | null,
): Promise<{ value: number | null; cache: CacheEntry | null }> {
  const cached = readCached(cache);
  if (cached != null) return { value: cached, cache };

  const apiKey = env.DATAFAST_API_KEY?.trim();
  if (!apiKey) return { value: null, cache };

  try {
    const response = await fetch(buildAnalyticsUrl(path, env), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const raw = await response.text();
    let body: DataFastMetricResponse | null = null;
    try {
      body = JSON.parse(raw) as DataFastMetricResponse;
    } catch {
      console.warn(`[datafast] ${path} non-JSON response status=${response.status}`);
      return { value: null, cache };
    }

    if (!response.ok || body.status !== "success") {
      console.warn(
        `[datafast] ${path} failed status=${response.status} code=${body.error?.code ?? "?"} msg=${body.error?.message ?? body.status ?? "?"}`,
      );
      return { value: null, cache };
    }

    const visitors = parseVisitors(body);
    if (visitors == null) {
      console.warn(`[datafast] ${path} missing visitors field`);
      return { value: null, cache };
    }

    const nextCache: CacheEntry = {
      value: visitors,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return { value: visitors, cache: nextCache };
  } catch (err) {
    console.warn(`[datafast] ${path} fetch error`, err);
    return { value: null, cache };
  }
}

export async function fetchDataFastOverviewVisitors(env: Env): Promise<number | null> {
  const result = await fetchMetric("overview", env, overviewCache);
  overviewCache = result.cache;
  return result.value;
}

export async function fetchDataFastRealtimeVisitors(env: Env): Promise<number | null> {
  const result = await fetchMetric("realtime", env, realtimeCache);
  realtimeCache = result.cache;
  return result.value;
}
