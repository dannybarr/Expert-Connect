---
name: Composite project ref staleness
description: Why typecheck reports phantom missing-property errors when the dev server works fine.
---

When a workspace uses TypeScript project references with `composite: true` and `emitDeclarationOnly: true` (e.g. `lib/db` here), downstream packages that `references` it consume the **emitted `.d.ts` in `dist/`**, not the live `src/`.

If schema or types in `src/` change but `dist/` is not rebuilt, `tsc --noEmit` in downstream packages will report errors against the stale shape (e.g. "Property 'about' does not exist on type 'Expert'") even though:
- The source files clearly have the property.
- The dev server (run via `tsx`) works fine because tsx reads `src/` directly.

**How to apply:** When you see typecheck failures that don't match what's in source, before doing any other investigation, rebuild the composite declarations:

```
rm -rf lib/<name>/dist
pnpm -w exec tsc -b lib/<name> --force
```

Or run the workspace-wide rebuild: `pnpm -w run typecheck:libs` (which is `tsc --build`).

**Why:** Composite refs cache declarations on disk; nothing in `tsx`/Vite/Drizzle's runtime forces a rebuild, so the cache silently rots across schema migrations.
