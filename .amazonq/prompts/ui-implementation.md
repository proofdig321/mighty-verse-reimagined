# Mighty Verse — UI Implementation Prompt for Agent

## Who you are

You are implementing the frontend UI for Mighty Verse Reimagined.
Read `.mighty-verse/` before every session. The constitutional context in `.amazonq/rules/constitutional-context.md` is always active.

---

## Hard constraints — read before touching any file

1. **No installs. No builds. No `npm`, `npx`, `yarn`, `pnpm` commands.** Codespaces memory is under 5%. File edits only.
2. **UI layer only.** Pages and components contain zero business logic. No Supabase queries, no API calls, no auth checks, no economic calculations inside page or component files.
3. **All data comes from the server via existing API routes or server components that call `getServiceClient()`.** Pages are `async` server components that fetch from existing lib functions or API routes. They pass plain typed props down to pure UI components.
4. **Do not create new API routes** unless explicitly instructed. The existing routes in `src/app/api/` are the data contract.
5. **Do not modify** `src/lib/`, `src/app/api/`, `supabase/`, or any file outside `src/app/` pages and `src/components/` unless explicitly instructed.
6. **When redesigning a page UI, do not change the data-layer logic unless the task explicitly says to.** Only the JSX return changes during a UI redesign.
6. **shadcn/ui components only.** Use what is already in `src/components/ui/`. Do not invent a parallel component system. Available: `button`, `badge`, `card`, `input`, `label`, `separator`, `tabs`, `avatar`.
7. **Tailwind CSS only for styling.** Use CSS variables already defined in `globals.css`. No inline style objects except for `var(--accent-mv)` and `var(--accent-mv-gold)` where Tailwind cannot reach a CSS variable.
8. **TypeScript strict.** Every prop type must be explicitly declared. No `any`.
9. **Minimal code.** Write only what is needed for the UI. No placeholder lorem ipsum logic, no fake data generators, no mock arrays — if real data is not available, render an empty state.

---

## Project structure you must respect

```
src/
  app/
    page.tsx                          ← Route: /  (Home)
    layout.tsx                        ← Root layout — sidebar already wired, DO NOT touch
    globals.css                       ← Theme tokens — DO NOT touch
    worlds/[masterId]/page.tsx        ← Universe + Mural detail
    moments/[projectionId]/page.tsx   ← Creative Moment card
    authority/page.tsx                ← Authority (auth-gated, keep redirect)
    creative-moments/[masterId]/page.tsx
    profile/page.tsx
    auth/sign-in/page.tsx
  components/
    nav.tsx          ← Left sidebar — already built, DO NOT rebuild
    ui/              ← shadcn/ui primitives only
    player/          ← Livepeer player — DO NOT modify
    artwork-frame.tsx
    moment-card.tsx
    media-hero.tsx
    experience-toggle.tsx
    web3/connect-button.tsx
```

---

## Wireframe reference

`.mighty-verse/wireframes/README.md` — full section map, visual identity spec, route mapping.
`.mighty-verse/wireframes/mighty-verse-wireframe.png` — the wireframe image.

The wireframe has 12 numbered sections. Each is a **separate page**, not a single dashboard.

---

## Visual identity — tokens already in globals.css

| Token | Use |
|---|---|
| `bg-background` | Page background (deep dark purple) |
| `bg-card` | Card surfaces |
| `border-border` | All borders |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary / label text |
| `var(--accent-mv)` | Purple accent — buttons, highlights, icons |
| `var(--accent-mv-gold)` | Gold accent — collectible badges, rarity |
| `bg-primary` / `text-primary-foreground` | Primary buttons |

---

## Data contracts — what each page receives

### `/` — Home (wireframe section 01)
Uses `getDiscovery()` from `@/lib/discovery`. Returns `DiscoveryUniverse[]`.
Each item: `master_id`, `title`, `description`, `has_media`, `canonical_type`, `projections[]`.

### `/worlds/[masterId]` — Universe or Mural detail (sections 03, 06)
Server component calls `getServiceClient()` directly. See existing `src/app/worlds/[masterId]/page.tsx` for the full query pattern. Universe type: title, description, murals list, moments list. Mural type: media player, scenes list.

### `/moments/[projectionId]` — Creative Moment card (section 05)
Type `MomentData` exported from `src/app/api/moments/[projectionId]/route.ts`.
Fields: `projection`, `canonical_state`, `master`, `provenance`, `attribution`, `media`, `presentation`, `worldTitle`.

### `/universes` — Browse (section 02)
Uses `getDiscovery()`. Filter by `canonical_type === 'universe'`.

### `/moments` — Browse (section 07)
Server component. `getServiceClient()` query: `projection` table joined with `projection_presentation` for title, `projection_media_binding` for has_media. Filter `collectible_designated` for Collectible tab.

### `/murals` — Browse (section 08)
Server component. `getServiceClient()` query: `master` where `canonical_type = 'mural'`, joined with `work_presentation`.

### `/authority` — Public (section 09)
Already exists. Redesign UI only — keep the auth redirect at the top of the server component.

### `/participants` — Public (section 10)
Server component. `getServiceClient()` query: `participant` joined with `participant_role` and `attribution_entry` where `public = true`.

### `/gallery` — Media Gallery (section 11)
Server component. `getServiceClient()` query: `media_asset` joined through `projection_media_binding` → `projection` → `work_presentation`.

### `/about` — Static (section 12)
Static page. Pull universe/moment counts from `getDiscovery()` for the stats row.

---

## Page structure pattern — follow this exactly

```tsx
// src/app/[route]/page.tsx
export const dynamic = "force-dynamic";
import { getServiceClient } from "@/lib/authority/validate";

type PageData = { /* explicit typed shape */ };

async function getData(): Promise<PageData> {
  const svc = getServiceClient();
  // DB queries only — no business logic
  return { ... };
}

export default async function RoutePage() {
  const data = await getData();
  return (
    <main className="min-h-screen bg-background">
      {/* UI only — pass data as props to components */}
    </main>
  );
}
```

---

## Component rules

- Every reusable UI piece goes in `src/components/` as its own file.
- Components are pure: typed props in, JSX out, nothing else.
- No `useState`, `useEffect`, `useRouter` in server components.
- Client interactivity (search input, tab switching, shuffle button) goes in a `[feature]-client.tsx` file with `"use client"` at the top, imported into the server page.
- Keep client components to the minimum interactive slice — not the whole page.

---

## Wireframe section implementation notes

### Section 01 — Home `/`
- Top nav bar inside the page (not the sidebar): Home / Universes / Moments / Murals / Scenes / Authority links + search icon + Connect Wallet button
- Hero: large headline "Every Song is a Universe. Every Moment is a Legend." + subtext + two CTA buttons ("Explore Universes" → `/universes`, "Watch Trailer" → renders disabled/placeholder)
- Featured Universes strip: horizontal scroll of universe thumbnail cards — artwork placeholder + title + artist + scene/moment counts. Each links to `/worlds/[master_id]`

### Section 02 — Universes Browse `/universes`
- "All Universes" heading + search input + genre filter dropdown
- Responsive grid of universe cards: artwork placeholder, title, artist name, scene count, moment count
- "View all" link

### Section 03 — Universe Detail `/worlds/[masterId]` (universe type)
- Universe name + "by [artist]" + Universe badge
- Stats row: Scenes, Moments, Collectibles, Holders, Base Network badge
- Two CTA buttons: "Enter Scene Deck" → `/worlds/[masterId]/scenes`, "View Mural" → `/murals/[masterId]`
- Tabs: Overview / Scenes / Moments / Participants / Activity (client component for switching)
- Overview tab: description + mural trailer thumbnail with play button
- "About this Universe" section

### Section 04 — Scene Deck `/worlds/[masterId]/scenes`
- "Scene Deck" heading + description
- Shuffle button + Grid View toggle (client component)
- Horizontal scrollable row of scene cards (playing card style, dark purple, gold border on selected)
- Timeline scrubber below
- "Drag cards to reorder your timeline" hint

### Section 05 — Creative Moment `/moments/[projectionId]`
- Left: card artwork (portrait ratio) with RARE badge + title + subtitle
- Right: title, scene reference, mural reference, description
- Tags: Collectible / Moment Card / ERC-1155
- Metadata grid: Rarity, Edition, Owner (truncated address), token ID
- Two buttons: "View in 2.5D", "Add to Timeline"

### Section 06 — Mural `/murals/[masterId]`
- New route — mural type masters only
- Heading: "[Universe title] — [Mural title]"
- Full-width video player using existing `ProjectionMediaPlayer`
- Playback controls row
- Right sidebar: "Scenes 1 of N" list — scene titles with timestamps, "View Scene Deck" button

### Section 07 — Moments Browse `/moments`
- "All Moments" heading + description
- Search input + "All Types" filter
- Filter tabs: All / Collectible / Moment Cards / Highlights (client component)
- Horizontal scroll row of moment cards: thumbnail + title + type label
- "View All Moments" button

### Section 08 — Mural Gallery `/gallery`
- "Mural Gallery" heading + description
- Genre filter + Most Recent sort (client component)
- Grid of mural cards: artwork placeholder + title + artist
- "View All Murals" button

### Section 09 — Authority `/authority`
- "Authority" heading + description
- Four info blocks: Notices / Proof of Publication / Participants / Governance
- Each block: icon + label + sub-description
- "Learn More" button

### Section 10 — Participants `/participants`
- "Creators & Participants" heading + description
- Filter tabs: All / Artists / Producers / Animators / Organizations (client component)
- Grid of participant cards: Avatar with initials fallback + name + role label
- "View All Participants" button

### Section 11 — Media Gallery `/media`
- "Media Gallery" heading + description
- Filter tabs: All Media / Videos / Images / Audio / Documents (client component)
- Grid of media thumbnails: video = play overlay, audio = waveform placeholder, doc = icon
- "View Full Gallery" button

### Section 12 — About `/about`
- "About Mighty Verse" heading
- Description paragraph
- Stats row: Universes 10+, Moments 1K+, Creators 50+, Community Growing
- "Join the Journey" CTA button

---

## Empty states — always render these, never hide a section

- Artwork not available: dark purple gradient placeholder div at the correct aspect ratio
- Participant avatar missing: `Avatar` shadcn component with initials fallback
- Media not ingested: muted text "Media coming soon"
- Empty list: single muted line "No [items] yet."

---

## Do not do

- No `console.log`
- No comments explaining what code does — write readable code instead
- No TODO comments
- No mock data arrays
- No `Math.random()` or `Date.now()` for display logic
- No animation libraries — `tw-animate-css` is already available
- No new dependencies
- Do not touch `src/lib/`, `src/app/api/`, `supabase/`
- Do not rebuild `nav.tsx` or `layout.tsx`
- No dark mode toggle — theme is always dark

---

## Build history — what has been done, do not redo

### Build 22 (committed 2bce075)
Files changed:
- `src/app/globals.css` — dark purple cosmic theme, all tokens set, always dark (no light mode)
- `src/app/layout.tsx` — fixed left sidebar wired, `ml-56` main content offset
- `src/components/nav.tsx` — full left sidebar: logo, tagline, core principles, experience pillars, global nav, connect wallet CTA, social footer.
- `src/app/worlds/[masterId]/page.tsx` — universe layout (section 03): stats row, badges, CTAs, WorldTabsClient. Mural layout (section 06): two-column player + scene sidebar.
- `src/components/world-tabs-client.tsx` — new. Overview/Scenes/Moments/Participants/Activity tabs.
- `.mighty-verse/wireframes/README.md` — wireframe section map

### Build 23

**New files:**
- `src/components/page-top-nav.tsx` — shared sticky top nav
- `src/components/universes-filter-client.tsx`
- `src/components/moments-filter-client.tsx`
- `src/components/participants-filter-client.tsx`
- `src/components/gallery-filter-client.tsx`
- `src/components/scene-deck-client.tsx`
- `src/app/universes/page.tsx` — section 02
- `src/app/moments/page.tsx` — section 07
- `src/app/murals/page.tsx` — section 08
- `src/app/about/page.tsx` — section 12
- `src/app/participants/page.tsx` — section 10
- `src/app/gallery/page.tsx` — section 11
- `src/app/media/page.tsx` — section 11 (alternate route)
- `src/app/authority/public/page.tsx` — section 09 (public, no auth)
- `src/app/scenes/page.tsx` — section 04

**Modified files:**
- `src/app/page.tsx` — section 01 rebuilt
- `src/app/moments/[projectionId]/page.tsx` — section 05 redesigned
- `src/components/artwork-frame.tsx` — gradient updated to purple theme
- `src/components/nav.tsx` — Authority link updated to `/authority/public`

## All 12 wireframe sections — implementation status

| Section | Route | Status |
|---|---|---|
| 01 | `/` | ✅ Build 23 |
| 02 | `/universes` | ✅ Build 23 |
| 03 | `/worlds/[masterId]` (universe) | ✅ Build 22 |
| 04 | `/scenes` | ✅ Build 23 |
| 05 | `/moments/[projectionId]` | ✅ Build 23 |
| 06 | `/worlds/[masterId]` (mural) | ✅ Build 22 |
| 07 | `/moments` | ✅ Build 23 |
| 08 | `/murals` | ✅ Build 23 |
| 09 | `/authority/public` | ✅ Build 23 |
| 10 | `/participants` | ✅ Build 23 |
| 11 | `/gallery` + `/media` | ✅ Build 23 |
| 12 | `/about` | ✅ Build 23 |

---

## Session start checklist

Before writing any code:
1. Read `.mighty-verse/wireframes/README.md`
2. Check build history above — confirm the route is not already done
3. Read the existing file for the route you are working on (if it exists)
4. Read the relevant API route type exports for the data shape
5. Confirm which wireframe section you are implementing
6. Write the server component page first, add a client slice only if interaction is required
