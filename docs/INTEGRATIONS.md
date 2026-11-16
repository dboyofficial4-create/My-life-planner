# Integrations status

| Integration | Status | What works | Needs | Fallback |
|---|---|---|---|---|
| Calendar file (.ics) | **Working** | Import due dates from an .ics export (e.g. Canvas "Calendar Feed"); preview; de-duplication by UID; labelled "Imported" | Nothing | Manual entry |
| Canvas LMS | **Needs credentials** | Status/disconnect UI, AES-256-GCM token encryption helper (`server/auth/crypto.ts`). OAuth flow and course/assignment sync are **not implemented** | A Developer Key from each institution's Canvas admin; `CANVAS_CLIENT_ID`, `CANVAS_CLIENT_SECRET`, `CANVAS_REDIRECT_URI`, `APP_ENCRYPTION_KEY` | .ics import, manual entry |
| Home Access Center | **Not supported** | Nothing | A district-approved data-sharing method; HAC has no universal public API | Manual grades with confirmed/unconfirmed weights |
| Sports data | Planned | Built-in general drills, labelled as unsourced | A verified source with acceptable licence, cost and coverage | Drills + user-logged results |
| Product / price data | Planned | Category-level care guidance | A licensed product data provider | No prices, stock, reviews or links are shown |

Policies: Waypoint never asks for school passwords and never scrapes restricted systems. `GET /api/integrations` returns this information and the UI renders it verbatim.

## Implementing Canvas (next steps)

1. Get a Developer Key per institution (scopes: courses, assignments, submissions read).
2. Add `/api/integrations/canvas/start` (authorize redirect with a `state` bound to the session) and `/callback` (code exchange server-side). Encrypt tokens with `encryptSecret`.
3. Sync courses and assignments with `source='canvas'` and `external_id`; record `last_sync_at` / `last_error`.
4. On disconnect, call Canvas's token-deletion endpoint, then delete the row.
