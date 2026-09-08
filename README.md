# Mighty Verse Reimagined

A canonical cultural universe platform for African creative culture, owned by Golden Shovel.

## Agent Context

See `.mighty-verse/AGENT.md` for the current implementation state, architecture, and development protocol.

See `.mighty-verse/05-architecture.md` for the deep constitutional model.

## Stack

- **Next.js 16** (App Router) + React + shadcn/ui + Tailwind CSS
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Mux** (current video provider) + **Livepeer** (legacy)
- **Vercel** (deployment)

## Development

Current environment: **Cursor** against this GitHub repository (`origin`).
Canonical default branch: **`main`** (`origin/main`). Chrome is the primary browser QA client.

```bash
npm run dev        # local Next.js server at http://localhost:3000 (required for browser QA)
npx tsc --noEmit   # type check
npm run lint       # lint
npm test           # unit + Sentinel tests (no browser)
npm run test:qa:browser  # Chrome smoke against the running app
```

## Tests

TypeScript, lint, and unit tests do not prove the UI works. Browser QA is a
separate evidence layer. See `qa/browser/README.md`.

```bash
# Unit tests (no browser)
npm test

# Browser smoke (Chrome, against the running app)
npm run test:qa:browser
```

Canonical public Universe pages are `/worlds/[masterId]`.
Example: `/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc`. There is no `/universes/[id]` route.

## Git

Repository: this GitHub remote (`origin`)
Canonical default branch: `main` (`origin/main`)
Development environment: Cursor + Chrome + this GitHub remote.
