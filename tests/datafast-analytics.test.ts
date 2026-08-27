import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DATAFAST_WEBSITE_ID,
  fetchDataFastOverviewVisitors,
  fetchDataFastRealtimeVisitors,
  resetDataFastCache,
} from "../worker/lib/datafast-analytics";
import type { Env } from "../worker/types";

const baseEnv = {
  DATAFAST_WEBSITE_ID: DEFAULT_DATAFAST_WEBSITE_ID,
} as Env;

describe("datafast-analytics", () => {
  beforeEach(() => {
    resetDataFastCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataFastCache();
  });

  it("adds websiteId for account tokens", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain(`websiteId=${DEFAULT_DATAFAST_WEBSITE_ID}`);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer dft_account_token" });
      return new Response(
        JSON.stringify({ status: "success", data: [{ visitors: 55 }] }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const visitors = await fetchDataFastOverviewVisitors({
      ...baseEnv,
      DATAFAST_API_KEY: "dft_account_token",
    });

    expect(visitors).toBe(55);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("omits websiteId for website API keys", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).not.toContain("websiteId=");
      return new Response(
        JSON.stringify({ status: "success", data: [{ visitors: 12 }] }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const visitors = await fetchDataFastRealtimeVisitors({
      ...baseEnv,
      DATAFAST_API_KEY: "df_website_key",
    });

    expect(visitors).toBe(12);
  });

  it("reuses cached overview responses within the TTL", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "success", data: [{ visitors: 99 }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = { ...baseEnv, DATAFAST_API_KEY: "df_test" } as Env;
    await expect(fetchDataFastOverviewVisitors(env)).resolves.toBe(99);
    await expect(fetchDataFastOverviewVisitors(env)).resolves.toBe(99);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
