# Waypoint

A personal planning system that turns goals, schedule and resources into a realistic daily plan, with fitness, sports, school, food and personal care coordinated by **one** planning engine.

## Quick start

Requires Node.js **22.13+**, which provides the built-in `node:sqlite`, so there are no native modules to build.

```bash
npm install
npm run dev        # API on :8787, web on :5173 (proxied). The API doesn't auto-restart; use `npm run dev:api:watch` for that (not reliable on Windows)
npm test           # domain + API tests
npm run build && npm start   # production build served by the API server on :8787
```

Open http://localhost:5173, then create an account or choose **Explore with demo data**. That creates a temporary, clearly labelled sample account, which is deleted after 24 hours.

To put it online (so you can use it from your phone or school), see `docs/DEPLOY.md`.

Copy `.env.example` to `.env` for configuration. No variables are required for local use.

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19, Vite, React Router, TanStack Query | Fast, typed SPA with cached server state and loading/error states |
| Design | Hand-built tokens and components (`src/styles`, `src/ui`) | One accent color, light/dark themes, no UI-kit look |
| API | Hono on Node | Small, typed, standard Request/Response |
| Data | SQLite via `node:sqlite`, numbered migrations | Real persistence with zero native deps; the repository layer isolates SQL |
| Validation | zod schemas in `shared/schemas`, used by client **and** server | One source of truth for forms and the API |
| Domain | Pure TypeScript in `shared/domain` | Deterministic, unit-tested planning and calculations |

## Project layout

```
shared/schemas     zod data model (profile, schedule, commitments, modules, plan actions)
shared/domain      planner (engine, builder, replan), fitness, nutrition, school, care, time zones, age policy
server/            Hono app, auth, user-scoped store (repos/store.ts), services, routes, integrations registry
src/               React app: ui/ (design system), features/<module>/, app/ (shell + routing)
tests/             vitest: planner, domain and API (auth, isolation, replanning, food, integrations)
docs/              ARCHITECTURE, INTEGRATIONS, PRIVACY_AND_SAFETY
```

See `docs/ARCHITECTURE.md` for how planning works and how to add a module.
