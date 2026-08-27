import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyRankChange } from "../worker/lib/email";
import { initTestDb } from "./schema";

describe("notifyRankChange", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM startups").run();
    env.EMAIL = {
      send: vi.fn(async () => ({ messageId: "test-email-id" })),
    };
  });

  it("skips email when last_notified_rank is null and seeds rank", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', datetime('now'), NULL)`,
    ).run();

    const startup = {
      id: 1,
      name: "Alpha",
      email: "alpha@test.com",
      product_url: "https://alpha.io",
      last_notified_rank: null as number | null,
    };

    await notifyRankChange(env, env.DB, startup, 3);

    expect(env.EMAIL!.send).not.toHaveBeenCalled();

    const row = await env.DB.prepare("SELECT last_notified_rank FROM startups WHERE id = 1").first<{
      last_notified_rank: number;
    }>();
    expect(row?.last_notified_rank).toBe(3);
  });

  it("sends outranked email when rank drops", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', datetime('now'), 2)`,
    ).run();

    const startup = {
      id: 1,
      name: "Alpha",
      email: "alpha@test.com",
      product_url: "https://alpha.io",
      last_notified_rank: 2,
    };

    await notifyRankChange(env, env.DB, startup, 4);

    const sendMock = env.EMAIL!.send as ReturnType<typeof vi.fn>;
    expect(sendMock).toHaveBeenCalledOnce();
    expect((sendMock.mock.calls[0]![0] as { subject?: string }).subject).toContain("outranked");
  });
});
