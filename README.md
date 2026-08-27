# Video Club

Public leaderboard of startups ranked by how many **real founder videos** they post about their product.

**Rank is the videos.** Real founder. Real product link. No AI.

Live at [videoclub.lol](https://videoclub.lol).

## How it works

1. Paste a video URL (YouTube, TikTok, Instagram).
2. The worker reads the video description and finds your product URL (not a platform link).
3. First video for a new startup requires an email.
4. Rank = count of valid videos. Tie-break: earlier first video wins.
5. One AI report removes the video **and** the entire startup from the board.

## Stack

- Cloudflare Workers (Hono API + SPA assets binding)
- D1 (`videoclub-db`)
- Bun, Vite, React 19, Tailwind 4
- Resend for founder emails

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
| `RESEND_API_KEY` | Founder welcome / rank / removal emails |

**Cloudflare Worker (production)**

Set via dashboard or CLI:

```bash
bunx wrangler secret put RESEND_API_KEY --env production
```

Email sends from `Video Club <hello@videoclub.lol>`.

If `RESEND_API_KEY` is missing, submissions still work — emails are skipped and logged.

## D1

- Account: Digital shift (`9ee3d7479a3c359681e3fab2c8cb22c0`)
- Database: `videoclub-db` (`e0797cb5-25d1-462f-a9bd-aa2c236a3209`)
- Region: WEUR

## License

MIT
