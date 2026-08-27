const WINDOW_MS = 60 * 60 * 1000;
const SUBMIT_LIMIT = 20;
const CHALLENGE_LIMIT = 20;

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: string }>();

  if (!row) {
    await db
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)")
      .bind(key, now.toISOString())
      .run();
    return { allowed: true };
  }

  const windowStart = new Date(row.window_start);
  const elapsed = now.getTime() - windowStart.getTime();

  if (elapsed >= WINDOW_MS) {
    await db
      .prepare("UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?")
      .bind(now.toISOString(), key)
      .run();
    return { allowed: true };
  }

  if (row.count >= limit) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  await db
    .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
    .bind(key)
    .run();
  return { allowed: true };
}

export async function rateLimitSubmit(db: D1Database, ipHash: string) {
  return checkRateLimit(db, `submit:${ipHash}`, SUBMIT_LIMIT);
}

export async function rateLimitChallenge(db: D1Database, ipHash: string) {
  return checkRateLimit(db, `challenge:${ipHash}`, CHALLENGE_LIMIT);
}
