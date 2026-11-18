# Integrations status

| Integration | Status | What works | Needs | Fallback |
|---|---|---|---|---|
| Calendar file (.ics) | **Working** | Import due dates from an .ics export (e.g. Canvas "Calendar Feed"); preview; de-duplication by UID; labelled "Imported" | Nothing | Manual entry |
| Canvas LMS | **Working (personal access token)** | Connect with a token the student creates in Canvas; imports active courses, assignments (due from 30 days ago on), submission status, assignment groups + weights, scores and Canvas's current grade; re-sync updates in place; disconnect with optional data removal | Your school must allow students to create access tokens. School-wide OAuth (Developer Key) is **not** implemented | .ics import, manual entry |
| Home Access Center | **Not supported** | Nothing | A district-approved data-sharing method; HAC has no universal public API | Manual grades with confirmed/unconfirmed weights |
| YouTube (vetted channels) | **Working (your API key)** | Video search for your focus skills, restricted by channel id to vetted channels (governing bodies + established coaching channels); channel names verified at runtime; safe search on; cached 7 days | A free YouTube Data API v3 key | Links to the vetted channels + written resources |
| Product / price data | Planned | Category-level care guidance | A licensed product data provider | No prices, stock, reviews or links are shown |

Policies: Waypoint never asks for school passwords and never scrapes restricted systems. `GET /api/integrations` returns this information and the UI renders it verbatim.

## Canvas details

* **How it connects:** `POST /api/integrations/canvas/token` checks the token against `GET /api/v1/users/self`, stores it encrypted (AES-256-GCM, key from `APP_ENCRYPTION_KEY` or an auto-generated `data/.encryption-key`), then syncs.
* **What it reads:** `GET /api/v1/courses?enrollment_state=active&include[]=total_scores` and `GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=submission`. It only reads, never writes.
* **Safety:** https only; no IP or localhost hosts; redirects aren't followed; pagination links must stay on the same host; the token is never logged, returned or exported.
* **Mapping:** weighted courses get one confirmed category per assignment group. Points-based courses get a single 100% category, so Waypoint's maths matches Canvas. Submitted or excused work is marked done; work you marked done is never reopened. Same-named manual courses, and items from an earlier .ics import, are adopted instead of duplicated.
* **Schedule notes:** items titled like "A Day", "B Day" or "No School" are skipped in both Canvas sync and calendar-file import, and previously imported ones are removed (manual items are never touched).
* **Limits:** sync is manual ("Sync now"); up to 25 courses; Canvas's own grade can differ from the calculation (dropped scores, late policies, extra credit), so both are shown.
* **Revoking:** a third party can't revoke a personal token without its id, so disconnecting deletes Waypoint's copy and tells the user to delete the token in Canvas (Account → Settings → Approved Integrations).
* **Next step (not built):** OAuth with a school-issued Developer Key, for schools that block personal tokens.

## Sports knowledge base

`shared/domain/sports/catalog.ts` holds skills, drills, self-tests, sources and vetted channels for each sport. Every source URL was located by web search when it was added. Drills name the resource they align with, or are labelled "general guidance". Self-tests compare a player only with their own earlier results; no age norms or benchmarks are invented.

* **Verified channels:** Breakthrough Basketball (@BreakthroughBBall), U.S. Soccer (@ussoccer), USA Football (@usafootball, channel id verified), USA Baseball (@USABaseball, channel id verified) and USA Volleyball (@USAVolleyball). No channel could be verified for swimming, tennis or track, so those sports show written resources only.
* **Pitch Smart:** the rest-day tiers and daily maximums for ages 7–18 were transcribed from search results that matched each other; mlb.com itself couldn't be loaded from the build environment. The UI always links to the official tables and says to follow league rules if they're stricter.
* **Cut / tryout mode:** with team status `cut`, `tryout_prep` or `no_team`, the plan supplies 4 skill sessions a week, with a skills check every 2–3 weeks. The build → sharpen → peak → taper phases count down to the tryout date, and hard training is kept off tryout day and the day before.
