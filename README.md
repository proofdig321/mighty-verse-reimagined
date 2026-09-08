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

```bash
npm run dev        # local dev server (required for browser QA)
npx tsc --noEmit   # type check
npm run lint       # lint
```

## Tests

TypeScript, lint, and unit tests do not prove the UI works. Browser QA is a
separate evidence layer. See `qa/browser/README.md`.

```bash
# Unit tests (no browser)
node --experimental-strip-types --experimental-loader ./src/lib/media/__tests__/ts-loader.mjs \
  src/lib/media/__tests__/provider-resolution.test.mjs \
  src/lib/media/__tests__/metadata.test.mjs \
  src/lib/media/__tests__/intake-workflow.test.mjs \
  src/lib/media/__tests__/inspection-wiring.test.mjs \
  src/lib/media/providers/mux/__tests__/mux.test.mjs \
  src/lib/media/__tests__/sentinel.test.mjs

# Browser smoke (Chrome, against the running app)
npm run test:qa:browser
```

## Branch

`mighty-verse-reimagined` → remote `source/main`

Push: `env -u GITHUB_TOKEN git push source HEAD:main`
