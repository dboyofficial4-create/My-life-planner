# Integrations status

| Integration | Status | What works | Needs | Fallback |
|---|---|---|---|---|
| Calendar file (.ics) | **Working** | Import due dates from an .ics export (e.g. Canvas "Calendar Feed"); preview; de-duplication by UID; labelled "Imported" | Nothing | Manual entry |
| Canvas LMS | **Working (personal access token)** | Connect with a token the student creates in Canvas; imports active courses, assignments (due from 30 days ago on), submission status, assignment groups + weights, scores and Canvas's current grade; re-sync updates in place; disconnect with optional data removal | Your school must allow students to create access tokens. School-wide OAuth (Developer Key) is **not** implemented | .ics import, manual entry |
| Home Access Center | **Not supported** | Nothing | A district-approved data-sharing method; HAC has no universal public API | Manual grades with confirmed/unconfirmed weights |
| Sports data | Planned | Built-in general drills, labelled as unsourced | A verified source with acceptable licence, cost and coverage | Drills + user-logged results |
| Product / price data | Planned | Category-level care guidance | A licensed product data provider | No prices, stock, reviews or links are shown |

Policies: Waypoint never asks for school passwords and never scrapes restricted systems. `GET /api/integrations` returns this information and the UI renders it verbatim.

## Canvas details

* **How it connects:** `POST /api/integrations/canvas/token` checks the token against `GET /api/v1/users/self`, stores it encrypted (AES-256-GCM, key from `APP_ENCRYPTION_KEY` or an auto-generated `data/.encryption-key`), then syncs.
* **What it reads:** `GET /api/v1/courses?enrollment_state=active&include[]=total_scores` and `GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=submission`. It only reads, never writes.
* **Safety:** https only; no IP or localhost hosts; redirects aren't followed; pagination links must stay on the same host; the token is never logged, returned or exported.
* **Mapping:** weighted courses get one confirmed category per assignment group. Points-based courses get a single 100% category, so Waypoint's maths matches Canvas. Submitted or excused work is marked done; work you marked done is never reopened. Same-named manual courses, and items from an earlier .ics import, are adopted instead of duplicated.
* **Limits:** sync is manual ("Sync now"); up to 25 courses; Canvas's own grade can differ from the calculation (dropped scores, late policies, extra credit), so both are shown.
* **Revoking:** a third party can't revoke a personal token without its id, so disconnecting deletes Waypoint's copy and tells the user to delete the token in Canvas (Account → Settings → Approved Integrations).
* **Next step (not built):** OAuth with a school-issued Developer Key, for schools that block personal tokens.
