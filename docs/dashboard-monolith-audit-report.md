# Dashboard Monolith Audit and Next-Phase Refactor Report

## Executive summary

The Storyboard feature was the first major proof that the dashboard architecture had drifted into a monolithic shell pattern: the workspace component owned layout, state orchestration, persistence, generation jobs, AI assist, Sentinel actions, history, and selection decisions in one place.

That pattern is not unique to Storyboard. It is a common dashboard-growth anti-pattern in this codebase: feature pages accumulate UI, orchestration, fetch logic, and domain behavior inside the screen component. This makes the app harder to reason about, more brittle under refactors, and more likely to crash during broad edits because changes are entangled across state and rendering boundaries.

At the current stage, the app is roughly at the midpoint of the intended architectural recovery. The Storyboard refactor proved the extraction pattern works and reduced the immediate monolith risk in that area. The remaining work is broader normalization across the dashboard surfaces, not a one-shot rewrite of the whole app.

## Current status of implementation

### Completed successfully

- Split Storyboard shell responsibilities into dedicated modules
- Extracted persistence lifecycle into a re-usable hook
- Extracted authoring + AI assist operations into a dedicated workflow hook
- Extracted generation operations and job orchestration logic
- Kept the active Storyboard workspace flow and work route behavior intact
- Verified the codebase still builds in production mode

### Verified evidence

Commands run successfully:

- `cd /workspaces/creative-studio-workbench && npx tsc --noEmit --pretty false`
- `cd /workspaces/creative-studio-workbench && npm run build`

Both completed successfully. The production build generated the expected routes, including Storyboard and Studio routes, with no TypeScript or build-breaking errors.

## What remained architectural risk

The real problem is not one giant file. The real problem is the repeated pattern:

- a feature shell owns everything
- fetch calls are embedded inside UI code
- local state becomes the domain model
- history, generation, and selection logic mutate directly in screen components
- business rules are not isolated behind service or hook boundaries
- the UI layer becomes the system-of-record

That pattern is what causes refactor crashes and unexpected regressions when multiple responsibilities are touched at once.

## Crash pattern analysis

The earlier failed attempts were not random faults; they reflected the same root cause repeatedly:

1. Combined state + UI refactors in a single component
2. Partial extraction without full wiring verification
3. Missing imports or stale references after component splits
4. Type mismatches when new modules used a slightly different data contract
5. Over-broad cleanup without validating the exact next layer

This is why the safer next step is not a full rewrite. It is a bounded, incremental extraction with compile validation after each phase.

## Architectural recommendation

The right pattern for this app is a layered feature architecture:

### 1. Feature shell
A page or view component should mostly do layout and orchestration.

### 2. Domain hooks
Stateful behavior belongs in dedicated hooks like:

- persistence
- history
- generation
- selection
- Sentinel interactions
- authoring assist

### 3. Domain services
Fetch logic and API contract work should move behind service modules rather than being embedded in components.

### 4. Pure logic modules
Rules like readiness checks, selection resolution, and content composition should be pure and testable.

### 5. Reducer-backed state for complex dashboards
For complex dashboards, a reducer or feature store is more stable than scattered `useState` orchestration.

## Suggested next phase

### Phase A: normalization of the remaining dashboard shells
Apply the same boundary pattern to the Studio and Universe dashboard shells that still resemble feature monoliths.

### Phase B: service boundary cleanup
Move direct `fetch` orchestration into domain service modules.

### Phase C: reducer-based state cleanup
For deeper dashboard flows, replace repeated local state with a reducer or feature state controller.

### Phase D: feature-level regression checks
Add focused checks around:

- save lifecycle
- generation readiness
- selection state
- history undo/redo
- authoring assist flow

## Credit / effort assessment

At this point, roughly half of the architectural recovery effort has been consumed: the first hard refactor patterns are proven and stable, but the broader dashboard normalization remains ahead. In practical terms:

- 50% of the effort is already invested in proving the architecture and extracting the Storyboard boundary
- the remaining 50% is the system-wide cleanup and standardization across the rest of the dashboards

This is not a failure of the implementation. It is a realistic architecture maturity curve for a product that grew by feature accumulation rather than clean layering from day one.

## Final recommendation

The next phase should remain incremental and risk-aware.

Do not chase a full application rewrite. Instead:

1. finish the remaining feature-shell boundaries
2. move orchestration behind services
3. standardize feature hooks
4. keep compile + build checks between each extraction phase
5. only then consider a broader dashboard consolidation pass

This strategy preserves product stability while steadily reducing the monolith footprint.

## Remote state

The current work was committed and pushed to the repository main branch after the Storyboard modularization pass.

Repository status after the final push was clean for the implemented refactor branch, and the remote was updated successfully.
