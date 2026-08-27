import {
  fetchDataFastOverviewVisitors,
  fetchDataFastRealtimeVisitors,
} from "./datafast-analytics";
import { getVisitorCounts, type VisitorCounts } from "./presence";
import type { Env } from "../types";

export interface PublicVisitorCounts extends VisitorCounts {
  statsShareUrl?: string;
}

function withShareUrl(counts: VisitorCounts, env: Env): PublicVisitorCounts {
  const shareUrl = env.DATAFAST_SHARE_URL?.trim();
  if (!shareUrl) return counts;
  return { ...counts, statsShareUrl: shareUrl };
}

export async function getPublicVisitorCounts(env: Env): Promise<PublicVisitorCounts> {
  const d1Counts = await getVisitorCounts(env.DB);
  const apiKey = env.DATAFAST_API_KEY?.trim();

  if (!apiKey) {
    return withShareUrl(d1Counts, env);
  }

  const [overviewVisitors, realtimeVisitors] = await Promise.all([
    fetchDataFastOverviewVisitors(env),
    fetchDataFastRealtimeVisitors(env),
  ]);

  return withShareUrl(
    {
      liveVisitorCount: realtimeVisitors ?? d1Counts.liveVisitorCount,
      visitorsSinceLaunch: overviewVisitors ?? d1Counts.visitorsSinceLaunch,
    },
    env,
  );
}
