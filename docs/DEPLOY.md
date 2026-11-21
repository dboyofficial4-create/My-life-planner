# Putting Waypoint online

Online, Waypoint works on your phone anywhere, reminders arrive even when your PC is off, and iPhone notifications work (they need the online `https://` version on the Home Screen).

## What it costs

Render, about **$7.25 a month**: the **Starter** web service (about $7) plus a **1 GB disk** (about $0.25). Check render.com/pricing for current prices.

The free plan won't work: it goes to sleep after 15 minutes with no visitors (reminders stop) and has no disk (every update would erase all accounts). An adult needs to create the Render account and add the card.

## 1. Create the service (about 10 minutes)

1. Go to **render.com** and sign up with GitHub (the GitHub account that owns `My-life-planner`). Add a payment method under **Billing**.
2. In the Render dashboard click **New → Blueprint**.
3. Pick the **My-life-planner** repository. Render finds `render.yaml` and shows one service, **waypoint**, with a disk.
4. Render asks for the settings marked "sync: false". Fill them in:

   | Setting | What to put |
   |---|---|
   | `APP_URL` | Leave empty for now (you'll know the address after step 5). |
   | `SIGNUP_CODE` | A code only your friends get, e.g. `falcons-2026`. People need it to sign up. **Set this if you add an AI key**, or strangers could run up your bill. |
   | `ANTHROPIC_API_KEY` | Your Claude key (`sk-ant-…`), if you want the AI features on for everyone. Billed to you; set a monthly limit in the Claude Console. |
   | `VAPID_SUBJECT` | `mailto:` plus an email you check, e.g. `mailto:you@gmail.com`. Push services use it if something goes wrong. |
   | `SMTP_…` | Leave empty unless you set up email (step 4). |

5. Click **Apply**. The first build takes a few minutes. When it says **Live**, your address is at the top, like `https://waypoint-ab12.onrender.com`.
6. Back in the service: **Environment → APP_URL**, paste that address, **Save, rebuild and deploy**.

Every `git push` to the `claude/life-improvement-app-vrherg` branch now updates the site automatically. Accounts, plans and keys are on the disk at `/var/data` and survive updates.

## 2. Set it up on your phone

- **iPhone (Safari):** open your address → **Share → Add to Home Screen** → open Waypoint from the new icon → Settings → Reminders → **Turn on notifications**.
- **Android (Chrome):** open your address → menu **⋮ → Install app** (or Add to Home screen) → Settings → Reminders → **Turn on notifications**.
- Make a **recovery code** (Settings → Password & recovery) and keep it somewhere safe.

## 3. Your data on your PC

The online Waypoint starts empty: sign up again there. Your PC's Waypoint (`data/waypoint.db`) is separate and stays as it is. There's no import yet.

## 4. Email (optional): "Forgot password?" by email

Recovery codes always work. To also send reset links by email, the easiest option is a Gmail account:

1. In the Google account you'll send from: **Manage your Google Account → Security**, turn on **2-Step Verification**.
2. Then search the settings for **App passwords**, create one named "Waypoint", and copy the 16-letter password.
3. In Render, **Environment**, set:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = that Gmail address
   - `SMTP_PASS` = the app password (not your normal Gmail password)
   - (optional) `MAIL_FROM` = `Waypoint <that address>`
4. **Save, rebuild and deploy**. Settings → Password & recovery now shows **Reset by email: On**.

Gmail allows a few hundred emails a day, plenty for this. Any other email provider with SMTP works the same way.

## 5. Backups

- Every day Waypoint saves a full copy of the database to `/var/data/backups/` and keeps the newest 7 (a bad update or a mistake can be undone from these).
- Render also takes its own daily snapshots of the disk; see the disk's page in the dashboard.
- The encryption key (`/var/data/.encryption-key`) and push keys (`/var/data/.vapid-keys.json`) live on the same disk. Don't delete the disk.

## What the server reads

| Setting | Meaning |
|---|---|
| `DATABASE_PATH` | Database file on the persistent disk (`/var/data/waypoint.db` on Render) |
| `TRUST_PROXY` | `1` behind Render, so rate limits see the visitor's real address |
| `APP_URL` | The public address, used in reset emails (never taken from the request) |
| `SIGNUP_CODE` | If set, sign-up requires it |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Server-wide AI keys (optional) |
| `COACH_DAILY_LIMIT` | Coach questions per person per day (default 40) |
| `VAPID_SUBJECT` | Contact for push services |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email for reset links (optional) |
| `APP_ENCRYPTION_KEY` | Optional; otherwise created on the disk the first time |
| Build / start | `npm ci && npm run build` / `npm start`. Don't set `NODE_ENV=production` for the build (it needs the dev tools). |
| Health check | `/api/health` |

## Before you invite other people

You'll be holding their personal data, and many will be under 18:

- Use a `SIGNUP_CODE` and only give it to people you know.
- They can export or delete everything in Settings → Privacy & data; tell them.
- The Terms of use (`/terms`) and privacy notes are a plain-language starting point, not legal review. Get adult or legal advice before opening it to the public.
- With a server-wide AI key, everyone's AI use is billed to you: set a monthly limit in the Claude Console.
