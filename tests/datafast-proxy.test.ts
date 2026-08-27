import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";

const runWorker = async (request: Request) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("DataFast proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies GET /js/script.js with day cache", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toBe("https://datafa.st/js/script.js");
      return new Response("window.datafast = true;", {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(new Request("http://videoclub.lol/js/script.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(await res.text()).toBe("window.datafast = true;");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("proxies POST /api/events with visitor IP and CORS", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toBe("https://datafa.st/api/events");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-datafast-real-ip")).toBe("203.0.113.42");
      expect(headers.get("Host")).toBe("datafa.st");
      expect(headers.get("cf-connecting-ip")).toBeNull();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(
      new Request("http://videoclub.lol/api/events", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "203.0.113.42",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: "pageview" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("handles OPTIONS /api/events for CORS preflight", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await runWorker(
      new Request("http://videoclub.lol/api/events", { method: "OPTIONS" }),
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
