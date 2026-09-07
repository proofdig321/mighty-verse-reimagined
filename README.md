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
npm run dev        # local dev server
npx tsc --noEmit   # type check
npm run lint       # lint
```

## Tests

```bash
node --experimental-strip-types --experimental-loader ./src/lib/media/__tests__/ts-loader.mjs \
  src/lib/media/__tests__/provider-resolution.test.mjs \
  src/lib/media/__tests__/metadata.test.mjs \
  src/lib/media/__tests__/intake-workflow.test.mjs \
  src/lib/media/__tests__/inspection-wiring.test.mjs \
  src/lib/media/providers/mux/__tests__/mux.test.mjs \
  src/lib/media/__tests__/sentinel.test.mjs
```

## Branch

`mighty-verse-reimagined` → remote `source/main`

Push: `env -u GITHUB_TOKEN git push source HEAD:main`
