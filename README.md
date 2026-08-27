# Video Club

Public leaderboard of startups ranked by how many **real founder videos** they post about their product.

**Rank is the videos.** Real founder on camera. Real product link. No AI.

Live at [videoclub.lol](https://videoclub.lol).

## How it works

1. Paste a video URL (YouTube, TikTok, Instagram).
2. We check for a person on camera and read the video description for your product URL.
3. First video for a new startup requires email and founder name.
4. Rank = count of valid videos. Tie-break: earlier first video wins.
5. One community report removes the video **and** the entire startup from the board.

## Stack

- Cloudflare Workers (Hono API + SPA assets binding)
- Cloudflare Email Service (outbound founder emails)
- Cloudflare Workers AI (face detection on thumbnails)
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

1. Apply D1 migrations remotely
2. `wrangler deploy --env production`

### Required secrets

**GitHub Actions**

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy + D1 migrations |

**Cloudflare Worker (production)**

- `send_email` binding (`EMAIL`) — configured in `wrangler.jsonc`
- Workers AI binding (`AI`) — for thumbnail face checks
- Email Service domain onboarded for `videoclub.lol`

If the `EMAIL` binding is missing or send fails, submissions still work — emails are skipped and logged.

## D1

- Account: Digital shift (`9ee3d7479a3c359681e3fab2c8cb22c0`)
- Database: `videoclub-db` (`e0797cb5-25d1-462f-a9bd-aa2c236a3209`)
- Region: WEUR

## License

MIT
