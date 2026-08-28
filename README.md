# Video Club

Public leaderboard of startups ranked by how many founder videos they post about their product.

**Rank is the videos.** Real product link in the description. The crowd judges legitimacy via public challenges.

Live at [videoclub.lol](https://videoclub.lol).

## How it works

1. Paste a video URL (YouTube, TikTok, Instagram, or X).
2. We read the video description for your product URL. No AI face check or founder-name gate at submit.
3. First video for a new startup requires email.
4. Rank = count of videos. Tie-break: earlier first video wins.
5. Anyone can challenge a video (AI, not the founder, not a real product). Three distinct challengers remove the video **and** the entire startup from the board.

## Stack

- Cloudflare Workers (Hono API + SPA assets binding)
- Cloudflare Email Service (outbound founder emails)
- D1 (`videoclub-db`)
- Bun, Vite, React 19, Tailwind 4

## Email setup (one-time)

Domain `videoclub.lol` is on Cloudflare DNS. Before production emails work:

1. Cloudflare dashboard → **Compute & AI** → **Email Service**
2. **Onboard Domain** → `videoclub.lol`
3. Complete SPF/DKIM as shown

Emails send from `Video Club <hello@videoclub.lol>` via the Worker `EMAIL` binding (`send_email` in `wrangler.jsonc`).

Preview templates locally at [/dev/emails](http://localhost:5173/dev/emails).

## Local development

```bash
bun install
bun run db:migrate:local
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Vite + Worker dev server |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest (Workers pool) |
| `bun run db:migrate:local` | Apply D1 migrations locally |
| `bun run db:migrate:remote` | Apply D1 migrations to production |
| `bun run deploy` | Build + deploy production |

## Deploy

CI runs on push/PR to `main`: typecheck, test, build.

Deploy runs after successful CI on `main` (or via workflow dispatch):

1. `bun run build` — `.env.production` sets `CLOUDFLARE_ENV=production` so the Vite plugin flattens `wrangler.jsonc` with `APP_URL=https://videoclub.lol` and custom domains (`videoclub.lol`, `www.videoclub.lol`). Without this, deploy uses `APP_URL=http://localhost:5173`.
2. Apply D1 migrations remotely (`migrations/0004_challenges.sql` drops the legacy `reports` table and creates `challenges`).
3. `wrangler deploy --env production` (uses the redirected config from `dist/videoclub/wrangler.json`).

### Required secrets

**GitHub Actions**

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy + D1 migrations. Needs **Workers Scripts Edit** and **D1 Edit** (error 7403 = missing D1 permission). Create at [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) with template "Edit Cloudflare Workers" + D1, or custom token scoped to account `9ee3d7479a3c359681e3fab2c8cb22c0`. |

**Cloudflare Worker (production)**

- `send_email` binding (`EMAIL`) — configured in `wrangler.jsonc`
- Email Service domain onboarded for `videoclub.lol`
- **Browser Rendering** — `browser` binding (`BROWSER`) in `wrangler.jsonc` fetches video pages/APIs through real Chrome when platforms block the Worker IP (LOGIN_REQUIRED, 429, consent walls). Enable Browser Rendering on the account, then deploy; no extra secret.
- **`DATAFAST_API_KEY`** (required for accurate visitor totals) — website `df_…` key or account `dft_…` token with `analytics:read`. Without it the pill falls back to D1 heartbeats and undercounts vs the DataFast dashboard. Create the key in DataFast → Website settings → Developer, then:
  ```bash
  wrangler secret put DATAFAST_API_KEY --env production
  ```
  Optional: `DATAFAST_SHARE_URL` for the pill’s “see stats→” link; `DATAFAST_WEBSITE_ID` (already in `wrangler.jsonc`) for `dft_` account tokens.
- **`PROXY_URL`** (optional secret) — HTTP fetch relay when you run your own proxy. Use a relay base URL such as `https://proxy.example/fetch?url=` (the worker appends `encodeURIComponent(target)`). Classic `https://user:pass@host:port` CONNECT proxies are not supported on Workers; use a relay instead.
- **`YOUTUBE_API_KEY`** (optional secret) — last-resort YouTube Data API v3 fallback when InnerTube/HTML scraping is blocked. Primary path uses InnerTube (ANDROID/IOS/WEB_EMBEDDED_PLAYER clients) and does not require a key.

Set optional secrets with Wrangler (never commit them):

```bash
wrangler secret put DATAFAST_API_KEY --env production
wrangler secret put DATAFAST_SHARE_URL --env production
wrangler secret put PROXY_URL --env production
wrangler secret put YOUTUBE_API_KEY --env production
```

If `PROXY_URL` is unset, blocked description fetches use Browser Rendering (`BROWSER`).

If the `EMAIL` binding is missing or send fails, submissions still work — emails are skipped and logged.

## D1

- Account: Digital shift (`9ee3d7479a3c359681e3fab2c8cb22c0`)
- Database: `videoclub-db` (`e0797cb5-25d1-462f-a9bd-aa2c236a3209`)
- Region: WEUR

## License

MIT
