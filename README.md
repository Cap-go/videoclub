# Video Club

Public leaderboard of startups ranked by how many founder videos they post about their product.

**Rank is the videos.** Real product link in the description. The crowd judges legitimacy via public challenges.

Live at [videoclub.lol](https://videoclub.lol).

## How it works

1. Paste a video URL (YouTube, TikTok, Instagram).
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
- `YOUTUBE_API_KEY` (optional secret) — last-resort fallback via YouTube Data API v3 when InnerTube/HTML scraping is blocked. Set with `wrangler secret put YOUTUBE_API_KEY --env production`. Primary path uses InnerTube (ANDROID/IOS player clients) and does not require a key.

If the `EMAIL` binding is missing or send fails, submissions still work — emails are skipped and logged.

## D1

- Account: Digital shift (`9ee3d7479a3c359681e3fab2c8cb22c0`)
- Database: `videoclub-db` (`e0797cb5-25d1-462f-a9bd-aa2c236a3209`)
- Region: WEUR

## License

MIT
