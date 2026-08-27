import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { initTestDb } from "./schema";
import { getChallengeCount, getLeaderboard, getStartupById } from "../worker/db/queries";
import { REMOVED_HOST_MESSAGE } from "../worker/lib/challenges";
import { FOREIGN_ACCOUNT_CODE, REVIEW_INBOX } from "../worker/lib/platform-account";

interface MockVideoFetchOptions {
  title?: string;
  description?: string;
  author?: string;
  author_url?: string;
}

function mockVideoFetch(extra?: MockVideoFetchOptions) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("noembed.com")) {
      return new Response(
        JSON.stringify({
          title: extra?.title ?? "Founder update",
          description: extra?.description ?? "Building https://newco.dev — follow along",
          author_name: extra?.author ?? "Founder",
          author_url: extra?.author_url,
        }),
        { status: 200 },
      );
    }
    if (url.includes("youtube.com/oembed")) {
      return new Response(
        JSON.stringify({
          title: extra?.title ?? "Founder update",
          author_name: extra?.author ?? "Founder",
          author_url: extra?.author_url ?? "https://www.youtube.com/@founder",
        }),
        { status: 200 },
      );
    }
    if (url.includes("youtubei/v1/player")) {
      return new Response(
        JSON.stringify({
          videoDetails: {
            shortDescription: extra?.description ?? "Building https://newco.dev — follow along",
          },
        }),
        { status: 200 },
      );
    }
    return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
  });
}

function mockEmailBinding() {
  env.EMAIL = {
    send: vi.fn(async () => ({ messageId: "test-email-id" })),
  };
}

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

async function postChallenge(videoId: number, ip: string, reason = "ai") {
  return runWorker(
    new Request(`http://example.com/api/challenge/${videoId}`, {
      method: "POST",
      headers: { "CF-Connecting-IP": ip, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),
  );
}

describe("community challenges", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM challenges").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();
    mockEmailBinding();

    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, last_notified_rank)
       VALUES (1, 'https://alpha.io', 'alpha.io', 'Alpha', 'alpha@test.com', '2026-01-01T00:00:00.000Z', 1),
              (2, 'https://beta.io', 'beta.io', 'Beta', 'beta@test.com', '2026-01-02T00:00:00.000Z', 2)`,
    ).run();

    await env.DB.prepare(
      `INSERT INTO videos (id, startup_id, video_url, video_id, platform, title, description, product_url_found, created_at)
       VALUES (1, 1, 'https://youtube.com/watch?v=a1', 'a1', 'youtube', 'Alpha v1', 'https://alpha.io', 'https://alpha.io', '2026-01-01T00:00:00.000Z'),
              (2, 2, 'https://youtube.com/watch?v=b1', 'b1', 'youtube', 'Beta v1', 'https://beta.io', 'https://beta.io', '2026-01-02T00:00:00.000Z')`,
    ).run();
  });

  it("shows public challenge counts on videos", async () => {
    await postChallenge(1, "1.1.1.1");
    await postChallenge(1, "2.2.2.2");

    const res = await runWorker(new Request("http://example.com/api/startups/1/videos"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { videos: Array<{ challenge_count: number }> };
    expect(body.videos[0]?.challenge_count).toBe(2);
  });

  it("rejects duplicate challenge from same IP", async () => {
    const first = await postChallenge(1, "3.3.3.3");
    expect(first.status).toBe(200);

    const second = await postChallenge(1, "3.3.3.3");
    expect(second.status).toBe(409);
    expect(await getChallengeCount(env.DB, 1)).toBe(1);
  });

  it("removes startup after three distinct challenges", async () => {
    for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) {
      const res = await postChallenge(1, ip);
      expect(res.status).toBe(200);
    }

    const startup = await getStartupById(env.DB, 1);
    expect(startup?.removed_at).toBeTruthy();

    const board = await getLeaderboard(env.DB);
    expect(board.some((e) => e.id === 1)).toBe(false);
  });

  it("rejects invalid challenge reason", async () => {
    const res = await postChallenge(1, "9.9.9.9", "fake_reason");
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Invalid");
  });

  it("emails founder on first challenge and on removal", async () => {
    const sendMock = env.EMAIL!.send as ReturnType<typeof vi.fn>;

    await postChallenge(1, "11.11.11.11", "ai");
    expect(sendMock.mock.calls.some((c) => (c[0] as { subject?: string }).subject?.includes("challenged"))).toBe(
      true,
    );

    sendMock.mockClear();
    await postChallenge(1, "12.12.12.12", "not_founder");
    await postChallenge(1, "13.13.13.13", "not_real_product");

    expect(sendMock.mock.calls.some((c) => (c[0] as { subject?: string }).subject?.includes("Removed"))).toBe(
      true,
    );
  });
});

describe("submit gates", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM challenges").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();
    mockEmailBinding();
  });

  it("requires email for new startup only", async () => {
    vi.stubGlobal("fetch", mockVideoFetch());

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "5.5.5.5", "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: "https://youtube.com/watch?v=new1" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { emailRequired?: boolean };
    expect(body.emailRequired).toBe(true);

    vi.unstubAllGlobals();
  });

  it("rejects re-submit for removed product host", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at, removed_at, removal_reason)
       VALUES (9, 'https://banned.io', 'banned.io', 'Banned', 'banned@test.com', datetime('now'), ?, 'Removed after challenges')`,
    )
      .bind(now)
      .run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({ title: "Comeback", description: "Back at https://banned.io" }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "8.8.8.8", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtube.com/watch?v=comeback1",
          email: "founder@banned.io",
        }),
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(REMOVED_HOST_MESSAGE);

    vi.unstubAllGlobals();
  });

  it("rejects duplicate platform video id", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES (3, 'https://taken.io', 'taken.io', 'Taken', 'taken@test.com', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, created_at)
       VALUES (3, 'https://youtube.com/watch?v=dup99', 'dup99', 'youtube', 'Existing', 'https://taken.io', 'https://taken.io', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({ title: "Steal attempt", description: "My product https://other.io" }),
    );

    const res = await runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: { "CF-Connecting-IP": "7.7.7.7", "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "https://youtu.be/dup99?si=tracking",
          email: "hacker@other.io",
        }),
      }),
    );

    expect(res.status).toBe(409);

    vi.unstubAllGlobals();
  });
});

describe("platform account locks", () => {
  beforeEach(async () => {
    await initTestDb(env.DB);
    await env.DB.prepare("DELETE FROM challenges").run();
    await env.DB.prepare("DELETE FROM videos").run();
    await env.DB.prepare("DELETE FROM startups").run();
    await env.DB.prepare("DELETE FROM rate_limits").run();
    mockEmailBinding();
  });

  async function postSubmit(
    videoUrl: string,
    email: string,
    options: { force?: boolean; ip?: string } = {},
  ) {
    return runWorker(
      new Request("http://example.com/api/submit", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": options.ip ?? "20.20.20.20",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl, email, force: options.force }),
      }),
    );
  }

  it("first video locks platform account", async () => {
    vi.stubGlobal(
      "fetch",
      mockVideoFetch({
        description: "Try https://capgo.app today",
        author_url: "https://www.youtube.com/@CapgoApp",
      }),
    );

    const res = await postSubmit("https://youtube.com/watch?v=lock1", "founder@capgo.app", {
      ip: "21.21.21.21",
    });
    expect(res.status).toBe(200);

    const video = await env.DB
      .prepare("SELECT platform_account FROM videos WHERE video_id = 'lock1'")
      .first<{ platform_account: string | null }>();
    expect(video?.platform_account).toBe("https://www.youtube.com/@capgoapp");

    vi.unstubAllGlobals();
  });

  it("second video from same account is accepted", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES (10, 'https://capgo.app', 'capgo.app', 'Capgo', 'founder@capgo.app', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, platform_account, created_at)
       VALUES (10, 'https://youtube.com/watch?v=first1', 'first1', 'youtube', 'First', 'https://capgo.app', 'https://capgo.app', 'https://www.youtube.com/@capgoapp', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({
        description: "https://capgo.app",
        author_url: "https://www.youtube.com/@CapgoApp",
      }),
    );

    const res = await postSubmit("https://youtube.com/watch?v=second1", "founder@capgo.app", {
      ip: "22.22.22.22",
    });
    expect(res.status).toBe(200);

    vi.unstubAllGlobals();
  });

  it("different account on same platform returns 409 without force", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES (11, 'https://capgo.app', 'capgo.app', 'Capgo', 'founder@capgo.app', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, platform_account, created_at)
       VALUES (11, 'https://youtube.com/watch?v=first2', 'first2', 'youtube', 'First', 'https://capgo.app', 'https://capgo.app', 'https://www.youtube.com/@capgoapp', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({
        description: "https://capgo.app",
        author_url: "https://www.youtube.com/@RandomAffiliate",
        author: "Random Affiliate",
      }),
    );

    const res = await postSubmit("https://youtube.com/watch?v=aff1", "founder@capgo.app", {
      ip: "23.23.23.23",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe(FOREIGN_ACCOUNT_CODE);
    expect(body.error).toContain("YouTube");

    vi.unstubAllGlobals();
  });

  it("force accepts and emails review inbox", async () => {
    await env.DB.prepare(
      `INSERT INTO startups (id, product_url, product_host, name, email, created_at)
       VALUES (12, 'https://capgo.app', 'capgo.app', 'Capgo', 'founder@capgo.app', datetime('now'))`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO videos (startup_id, video_url, video_id, platform, title, description, product_url_found, platform_account, created_at)
       VALUES (12, 'https://youtube.com/watch?v=first3', 'first3', 'youtube', 'First', 'https://capgo.app', 'https://capgo.app', 'https://www.youtube.com/@capgoapp', datetime('now'))`,
    ).run();

    vi.stubGlobal(
      "fetch",
      mockVideoFetch({
        description: "https://capgo.app",
        author_url: "https://www.youtube.com/@OtherCapgo",
        author: "Other Capgo",
      }),
    );

    const sendMock = env.EMAIL!.send as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const res = await postSubmit("https://youtube.com/watch?v=aff2", "founder@capgo.app", {
      force: true,
      ip: "24.24.24.24",
    });
    expect(res.status).toBe(200);

    expect(
      sendMock.mock.calls.some((c) => (c[0] as { to?: string }).to === REVIEW_INBOX),
    ).toBe(true);
    expect(
      sendMock.mock.calls.some((c) =>
        (c[0] as { subject?: string }).subject?.includes("review"),
      ),
    ).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe("email previews", () => {
  it("returns all email template previews", async () => {
    const res = await runWorker(new Request("http://example.com/api/dev/email-previews"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { previews: Array<{ kind: string }> };
    expect(body.previews.map((p) => p.kind)).toEqual(["welcome", "rank_changed", "challenged", "removed"]);
  });
});
