# Privacy, security and safety

## Implemented

* **Data minimisation**: onboarding only asks about the areas the user chooses; settings for unselected modules are discarded. Height and weight are optional. Photos are only used by the skin product finder (face photos, 14+, face and shoulders only) and the build planner (a goal-build photo of someone else from 14; photos of the user's own body 18+), only after the user ticks both the consent box and the photo-rules box (Terms §3); they are shrunk and stripped of EXIF/GPS data in the browser, sent once to the configured AI (Anthropic, or Google Gemini when only GEMINI_API_KEY is set), and never stored by Waypoint (only the written result is). On Gemini's free tier Google may retain and review submissions; the consent text says this. Below those ages the same tools work from answers alone. Body photos stay 18+ deliberately: a revealing photo of a minor must never be received or forwarded, and body comparison is a known eating-disorder trigger for teens; a terms clause doesn't remove either risk.
* **Auth**: scrypt password hashes; random 256-bit session tokens stored as SHA-256 hashes; HttpOnly, SameSite=Lax cookies (Secure in production); 30-day expiry; rate-limited login, registration and demo creation.
* **CSRF**: writes must be JSON (except DELETE) and same-origin by the `Origin` header.
* **Isolation**: every query is user-scoped through `UserStore`, covered by tests.
* **Export and deletion**: full JSON export; account deletion cascades to every table.
* **Logging**: errors log only route and error type, never bodies or personal data.
* **Secrets**: none in client code; integration tokens are encrypted server-side with `APP_ENCRYPTION_KEY`.
* **Reminders**: push messages are empty wake-ups, so reminder text never passes through the browser's push service; reminders are kept 14 days, never sent during sleep hours, and can be turned off per type or entirely.
* **Progress photos (athletes, 14+)**: never leave the device. Encrypted in the browser (PBKDF2-SHA-256, 600,000 rounds → non-extractable AES-256-GCM key held only in memory; a random IV per photo; date and note encrypted with the image) and stored in that browser's IndexedDB, one database per account. Locks after 5 idle minutes or when the tab is hidden; 30-second cool-down after 5 wrong passcodes; a forgotten passcode can only wipe the vault. The server has no route that accepts them and they're not in the export (both covered by tests).
* **Content-Security-Policy**: every page may only connect to, post forms to and load scripts from Waypoint itself (`server/security.ts`, also applied by the dev server), so on-device data can't be sent elsewhere even by an injected script. Verified in a browser: fetch, beacon, image and form requests to another origin were all blocked.
* **Skin finder and build planner**: never rate looks or identify people; unusable or inappropriate photos are rejected; for under-18s no weight or body-fat numbers and no dieting (enforced in the prompt and filtered again on the server); warning signs point to a doctor.
* **Demo data**: separate flagged accounts that can't log in with a password and are purged after 24 hours.

## Age-dependent rules (`shared/domain/age.ts`)

* Under 13: self-registration is blocked (no guardian consent flow exists yet).
* 13–17 or unknown age: no calorie deficits or body-composition/weight-loss goals, no body-weight logging, effort capped at RPE 8, no maximal lifts, fuelling-focused meal notes.

## Content safety

Nutrition values are labelled rough estimates. Care routines recommend product categories, introduce actives gradually, include patch-testing and "see a clinician" guidance, and make no diagnoses. Workouts exclude movements that load disclosed limitations and flag reported discomfort.

## Needs qualified review before launch

* The plain-language Terms of use (`/terms`) are a starting point written without legal review.

No legal or regulatory compliance is claimed. Before launch, get review of:

* COPPA (under-13) and any guardian consent flow; state student-privacy laws; FERPA implications of school integrations; GDPR/UK GDPR if offered in Europe (lawful basis, DPA, data subject rights); health-adjacent data handling.
* A security review: penetration test, dependency audit, session/CSRF hardening for the chosen deployment, backup encryption, and a persistent rate limiter (the current one is in-memory).
* A written retention policy (currently: data is kept until the user deletes it, demo accounts 24 h, sessions 30 days).
