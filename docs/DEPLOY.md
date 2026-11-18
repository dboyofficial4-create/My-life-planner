# Putting Waypoint online

Waypoint is one Node server plus a SQLite database file. Any host works if it can run Node 22+ and keep one folder between restarts. Without a persistent folder, every account and plan is wiped on each restart.

## Render (recommended: everything in the browser)

The repo includes `render.yaml`, which describes the service.

1. Have an adult create an account at https://render.com and add a payment method (the paid starter plan is needed for the disk).
2. **New → Blueprint**, connect GitHub, pick the `My-life-planner` repository and the `claude/life-improvement-app-vrherg` branch.
3. Render reads `render.yaml`. When it asks for `ANTHROPIC_API_KEY`, leave it empty unless you want AI study sets on for everyone, paid by that key.
4. Click **Apply**. The first build takes a few minutes. Your site is at `https://waypoint-XXXX.onrender.com`.
5. Every `git push` to that branch redeploys automatically. The database and the encryption key live on the disk at `/var/data` and survive redeploys. Render snapshots disks daily.

## Railway (alternative)

New project → Deploy from GitHub repo. Set:
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Add a **Volume** mounted at `/data`, and the variable `DATABASE_PATH=/data/waypoint.db`
- Generate a public domain under Settings → Networking.

## What the server needs

| Setting | Value |
|---|---|
| Node | 22 or newer (`.node-version`) |
| Build | `npm ci && npm run build` (dev dependencies are needed for the build, so don't set `NODE_ENV=production` at build time) |
| Start | `npm start` (runs in production mode: serves the built site, uses Secure cookies) |
| `PORT` | Set by the host |
| `DATABASE_PATH` | A file on the persistent disk, e.g. `/var/data/waypoint.db` |
| `APP_ENCRYPTION_KEY` | Optional. Otherwise a key is created next to the database the first time it's needed. Back it up with the database: without it, stored integration tokens can't be decrypted. |
| `ANTHROPIC_API_KEY` | Optional. Server-wide AI key. |
| Health check | `/api/health` |

## Before you invite other people

Running it for yourself is low-risk. Letting other people (especially other students) sign up means you hold their personal data. Read `docs/PRIVACY_AND_SAFETY.md` → "Needs qualified review before launch". At minimum:
- Tell people what's stored and that they can export or delete it (Settings → Privacy & data).
- Under-13 sign-ups are blocked, but other minors' data still deserves care, and laws differ by country and state. Get adult/legal advice before a public launch.
- If you set a server-wide `ANTHROPIC_API_KEY`, everyone's AI usage is billed to that key. Set a spend limit in the Anthropic Console.
- Back up the disk (Render snapshots it daily; you can also download the database file).
