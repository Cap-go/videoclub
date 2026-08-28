import { useEffect, useState } from "react";

const HEARTBEAT_MS = 25000;

export interface VisitorCounts {
  liveVisitorCount: number;
  visitorsSinceLaunch: number;
  statsShareUrl?: string;
  sources?: {
    live: "datafast" | "d1";
    total: "datafast" | "d1";
  };
}

async function postVisitors(): Promise<VisitorCounts> {
  const res = await fetch("/api/visitors", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Visitors POST failed (${res.status})`);
  return res.json() as Promise<VisitorCounts>;
}

export function useVisitors(): VisitorCounts | null {
  const [counts, setCounts] = useState<VisitorCounts | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      void postVisitors()
        .then(setCounts)
        .catch(() => {});
    };

    const startHeartbeat = () => {
      if (interval) return;
      interval = setInterval(tick, HEARTBEAT_MS);
    };

    const stopHeartbeat = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    tick();
    if (document.visibilityState === "visible") startHeartbeat();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return counts;
}
