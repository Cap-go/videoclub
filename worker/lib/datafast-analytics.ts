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
    if (!response.ok) return { value: null, cache };

    const body = (await response.json()) as DataFastMetricResponse;
    if (body.status !== "success") return { value: null, cache };

    const visitors = body.data?.[0]?.visitors;
    if (typeof visitors !== "number" || !Number.isFinite(visitors)) {
      return { value: null, cache };
    }

    const nextCache: CacheEntry = {
      value: visitors,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return { value: visitors, cache: nextCache };
  } catch {
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
