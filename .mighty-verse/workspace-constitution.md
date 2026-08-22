# Mighty Verse Workspace Constitution

SOURCE: established 2026-08-22, approved by project owner
CANONICAL: yes

## Authority Hierarchy

1. Git repository is authoritative for application state.
2. Supabase migrations are authoritative for schema evolution.
3. `.mighty-verse/` is authoritative for product and architecture history.

## Disk Space as Infrastructure Constraint

Disk space is a first-class infrastructure constraint.
A full disk is a development blocker equivalent to a bad schema.
Disk hygiene is part of the project's infrastructure constitution.

## Artifact Categories

| Category | Examples | Treatment |
|---|---|---|
| Canonical / protected | src, supabase, scripts, .mighty-verse, package.json, package-lock.json, config files, migrations, committed assets | Never delete |
| Reproducible workspace | node_modules, .next build cache | Remove when necessary; restore with npm install / next build |
| Temporary / cache | logs, .tmp, .cache, agent scratch files, generated reports | Inspect, then clean routinely |

## Cleanup Protocol

Before any destructive cleanup:
1. Inspect — find candidate paths
2. Identify — classify each by category above
3. Estimate — state space recovered and recovery method
4. Obtain approval — do not delete until approved

After cleanup:
1. Verify disk: `df -h /workspaces`
2. Verify git status: `git status --short`
3. Verify HEAD: `git log -1 --oneline`

## Standing Rules

- Never blindly delete to make space.
- Never reinstall large dependencies merely to leave the workspace looking complete. Install only when the next operation requires them.
- No cleanup may remove canonical source, migrations, documentation, scripts, configuration, or uncommitted product work.
- Temporary agent artifacts are disposable only after inspection and approval.
