export const PRESENCE_COOKIE = "videoclub_vid";
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const PRESENCE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface VisitorCounts {
  liveVisitorCount: number;
  visitorsSinceLaunch: number;
}

export async function ensurePresenceTable(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS presence (
        visitor_id TEXT PRIMARY KEY,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen)",
    ),
  ]);
}

export function resolveVisitorId(cookieValue: string | undefined, bodyVisitorId?: string): string {
  const fromBody = bodyVisitorId?.trim();
  if (fromBody && UUID_RE.test(fromBody)) return fromBody;
  if (cookieValue && UUID_RE.test(cookieValue)) return cookieValue;
  return crypto.randomUUID();
}

export async function getVisitorCounts(db: D1Database): Promise<VisitorCounts> {
  await ensurePresenceTable(db);
  const onlineCutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

  const onlineRow = await db
    .prepare("SELECT COUNT(*) AS count FROM presence WHERE last_seen >= ?")
    .bind(onlineCutoff)
    .first<{ count: number }>();

  const totalRow = await db
    .prepare("SELECT COUNT(*) AS count FROM presence")
    .first<{ count: number }>();

  return {
    liveVisitorCount: onlineRow?.count ?? 0,
    visitorsSinceLaunch: totalRow?.count ?? 0,
  };
}

export async function recordVisitor(db: D1Database, visitorId: string): Promise<VisitorCounts> {
  await ensurePresenceTable(db);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?)
       ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen`,
    )
    .bind(visitorId, now, now)
    .run();

  return getVisitorCounts(db);
}
