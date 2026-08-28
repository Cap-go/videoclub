import {
  fetchDataFastOverviewVisitors,
  fetchDataFastRealtimeVisitors,
} from "./datafast-analytics";
import { getVisitorCounts, type VisitorCounts } from "./presence";
import type { Env } from "../types";

export type VisitorCountSource = "datafast" | "d1";

export interface PublicVisitorCounts extends VisitorCounts {
  statsShareUrl?: string;
  /** Where each public number came from — helps spot silent DataFast fallback. */
  sources: {
    live: VisitorCountSource;
    total: VisitorCountSource;
  };
}

function withShareUrl(
  counts: VisitorCounts,
  sources: PublicVisitorCounts["sources"],
  env: Env,
): PublicVisitorCounts {
  const shareUrl = env.DATAFAST_SHARE_URL?.trim();
  const base: PublicVisitorCounts = { ...counts, sources };
  if (!shareUrl) return base;
  return { ...base, statsShareUrl: shareUrl };
}

export async function getPublicVisitorCounts(env: Env): Promise<PublicVisitorCounts> {
  const d1Counts = await getVisitorCounts(env.DB);
  const apiKey = env.DATAFAST_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "[visitors] DATAFAST_API_KEY missing — using D1 presence counts (undercounts vs DataFast dashboard)",
    );
    return withShareUrl(d1Counts, { live: "d1", total: "d1" }, env);
  }

  const [overviewVisitors, realtimeVisitors] = await Promise.all([
    fetchDataFastOverviewVisitors(env),
    fetchDataFastRealtimeVisitors(env),
  ]);

  if (overviewVisitors == null) {
    console.warn("[visitors] DataFast overview unavailable — falling back to D1 for total");
  }
  if (realtimeVisitors == null) {
    console.warn("[visitors] DataFast realtime unavailable — falling back to D1 for live");
  }

  return withShareUrl(
    {
      liveVisitorCount: realtimeVisitors ?? d1Counts.liveVisitorCount,
      visitorsSinceLaunch: overviewVisitors ?? d1Counts.visitorsSinceLaunch,
    },
    {
      live: realtimeVisitors != null ? "datafast" : "d1",
      total: overviewVisitors != null ? "datafast" : "d1",
    },
    env,
  );
}
