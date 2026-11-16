# Privacy, security and safety

## Implemented

* **Data minimisation**: onboarding only asks about the areas the user chooses; settings for unselected modules are discarded. Height and weight are optional. No photos are collected.
* **Auth**: scrypt password hashes; random 256-bit session tokens stored as SHA-256 hashes; HttpOnly, SameSite=Lax cookies (Secure in production); 30-day expiry; rate-limited login, registration and demo creation.
* **CSRF**: writes must be JSON (except DELETE) and same-origin by the `Origin` header.
* **Isolation**: every query is user-scoped through `UserStore`, covered by tests.
* **Export and deletion**: full JSON export; account deletion cascades to every table.
* **Logging**: errors log only route and error type, never bodies or personal data.
* **Secrets**: none in client code; integration tokens are encrypted server-side with `APP_ENCRYPTION_KEY`.
* **Demo data**: separate flagged accounts that can't log in with a password and are purged after 24 hours.

## Age-dependent rules (`shared/domain/age.ts`)

* Under 13: self-registration is blocked (no guardian consent flow exists yet).
* 13–17 or unknown age: no calorie deficits or body-composition/weight-loss goals, no body-weight logging, effort capped at RPE 8, no maximal lifts, fuelling-focused meal notes.

## Content safety

Nutrition values are labelled rough estimates. Care routines recommend product categories, introduce actives gradually, include patch-testing and "see a clinician" guidance, and make no diagnoses. Workouts exclude movements that load disclosed limitations and flag reported discomfort.

## Needs qualified review before launch

No legal or regulatory compliance is claimed. Before launch, get review of:

* COPPA (under-13) and any guardian consent flow; state student-privacy laws; FERPA implications of school integrations; GDPR/UK GDPR if offered in Europe (lawful basis, DPA, data subject rights); health-adjacent data handling.
* A security review: penetration test, dependency audit, session/CSRF hardening for the chosen deployment, backup encryption, and a persistent rate limiter (the current one is in-memory).
* A written retention policy (currently: data is kept until the user deletes it, demo accounts 24 h, sessions 30 days).
