const DATAFAST_HOST = "datafa.st";
const DATAFAST_WIDGET_ID = "6a90233b9514c70c504828be";

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
]);

function filterHeaders(original: Headers): Headers {
  const headers = new Headers();
  for (const [key, value] of original.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  return headers;
}

function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return headers;
}

export function datafastClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

export async function proxyDatafastScript(request: Request): Promise<Response> {
  const response = await fetch(`https://${DATAFAST_HOST}/js/script.js`, {
    method: request.method,
    headers: filterHeaders(request.headers),
  });

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=86400");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function proxyDatafastWidget(request: Request): Promise<Response> {
  const query = new URL(request.url).search;
  const response = await fetch(
    `https://${DATAFAST_HOST}/widgets/${DATAFAST_WIDGET_ID}/realtime${query}`,
    {
      method: request.method,
      headers: filterHeaders(request.headers),
    },
  );

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function proxyDatafastEvents(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const headers = filterHeaders(request.headers);
  headers.set("x-datafast-real-ip", datafastClientIp(request));
  headers.set("Host", DATAFAST_HOST);

  const response = await fetch(`https://${DATAFAST_HOST}/api/events`, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
  });

  const responseHeaders = new Headers(response.headers);
  for (const [key, value] of corsHeaders().entries()) {
    responseHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
