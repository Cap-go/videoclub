import { Hono } from "hono";
import type { Env } from "./types";
import { proxyDatafastEvents, proxyDatafastScript, proxyDatafastWidget } from "./lib/datafast-proxy";
import { api } from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
});

app.get("/api/health", (c) => c.json({ ok: true, service: "videoclub" }));

app.get("/js/script.js", (c) => proxyDatafastScript(c.req.raw));
app.get("/widgets/6a90233b9514c70c504828be/realtime", (c) => proxyDatafastWidget(c.req.raw));
app.all("/api/events", (c) => proxyDatafastEvents(c.req.raw));

app.route("/api", api);

app.all("*", async (c) => {
  const assets = c.env.ASSETS;
  if (!assets) {
    return c.text("Video Club API running. Build the frontend with `bun run build`.", 404);
  }
  return assets.fetch(c.req.raw);
});

export default app;
