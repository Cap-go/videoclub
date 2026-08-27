import puppeteer from "@cloudflare/puppeteer";

export const BROWSER_FETCH_BUDGET_MS = 12_000;

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface BrowserFetchResult {
  status: number;
  body: string;
  contentType: string | null;
}

function headersRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

async function withBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Browser fetch timed out")), budgetMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Fetch a URL inside Cloudflare Browser Rendering (real Chrome UA). */
export async function browserFetch(
  browserBinding: BrowserRun,
  targetUrl: string,
  init: RequestInit = {},
): Promise<BrowserFetchResult> {
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_USER_AGENT);

    const method = (init.method ?? "GET").toUpperCase();
    const headers = headersRecord(init.headers);
    const body = typeof init.body === "string" ? init.body : undefined;

    if (method === "GET" && !body) {
      const response = await withBudget(
        page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: BROWSER_FETCH_BUDGET_MS,
        }),
        BROWSER_FETCH_BUDGET_MS,
      );
      const html = await page.content();
      return {
        status: response?.status() ?? 200,
        body: html,
        contentType: "text/html",
      };
    }

    const result = await withBudget(
      page.evaluate(
        async (url, fetchMethod, fetchBody, fetchHeaders) => {
          const res = await fetch(url, {
            method: fetchMethod,
            body: fetchBody || undefined,
            headers: fetchHeaders,
            credentials: "include",
          });
          return {
            status: res.status,
            body: await res.text(),
            contentType: res.headers.get("content-type"),
          };
        },
        targetUrl,
        method,
        body ?? "",
        headers,
      ),
      BROWSER_FETCH_BUDGET_MS,
    );

    return result;
  } finally {
    await browser.close();
  }
}
