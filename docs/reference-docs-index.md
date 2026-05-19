# Vendor Documentation Reference Index

## Purpose

`reference/vendor-docs/` is a **local-only quarantined area** for cloning the official documentation and/or source repositories of the technologies FieldLog depends on. It exists so that AI-assisted development can consult authoritative, version-pinnable references without inventing APIs from memory and without polluting the FieldLog source tree.

These clones are **external documentation / source references**, not FieldLog source code. They are **gitignored** (see `.gitignore`: `reference/vendor-docs/`) and must never be committed, copied wholesale into `src/`, or treated as if they were part of FieldLog.

This index file *is* tracked. The clones it points at are *not*.

## How to populate

From the repository root, on Windows:

```cmd
scripts\clone-reference-docs.cmd
```

The script:

- Skips any folder that already exists (re-run is safe and resumes failed clones).
- Uses `--depth 1` to keep clones small.
- Returns to your original working directory when done.

To refresh a single doc, delete its folder under `reference/vendor-docs/` and re-run the script.

## What lives where

Currently in scope (cloned by the script):

| Technology | Local folder under `reference/vendor-docs/` | Upstream |
|---|---|---|
| React | `react.dev` | https://github.com/reactjs/react.dev |
| Vite | `vite` | https://github.com/vitejs/vite |
| TypeScript (website / docs) | `TypeScript-Website` | https://github.com/microsoft/TypeScript-Website |
| Material UI (MUI) | `material-ui` | https://github.com/mui/material-ui |
| Dexie / IndexedDB wrapper | `Dexie.js` | https://github.com/dexie/Dexie.js |
| React Hook Form (docs) | `react-hook-form-documentation` | https://github.com/react-hook-form/documentation |
| React Hook Form Resolvers | `react-hook-form-resolvers` | https://github.com/react-hook-form/resolvers |
| Zod | `zod` | https://github.com/colinhacks/zod |
| Vitest | `vitest` | https://github.com/vitest-dev/vitest |
| Testing Library (docs) | `testing-library-docs` | https://github.com/testing-library/testing-library-docs |

Deferred until the offline/PWA work begins (intentionally **not** cloned yet to keep disk + context lean):

| Technology | Will go to | Upstream |
|---|---|---|
| Vite PWA plugin | `vite-plugin-pwa` | https://github.com/vite-pwa/vite-plugin-pwa |
| Workbox | `workbox` | https://github.com/googlechrome/workbox |
| MDN Web Docs content | `mdn-content` | https://github.com/mdn/content |

When PWA/offline work starts, add these three back to `scripts/clone-reference-docs.cmd` and update this index.

## Which docs to consult for which task

Use this table to keep AI-assisted lookups narrowly scoped. Open only the folder(s) actually relevant to the task.

| Task type | Primary docs | Supporting docs |
|---|---|---|
| App scaffolding, dev server, build pipeline | `vite` | — |
| React component / hook design, rendering model | `react.dev` | — |
| TypeScript language / tsconfig / type ergonomics | `TypeScript-Website` | — |
| MUI components, theming, layout primitives | `material-ui` | `react.dev` |
| Form state, validation wiring | `react-hook-form-documentation` | `react-hook-form-resolvers`, `zod` |
| Schema / domain validation, parsing, refinements | `zod` | — |
| Bridging RHF ↔ Zod / Yup / etc. | `react-hook-form-resolvers` | `react-hook-form-documentation`, `zod` |
| IndexedDB / Dexie schema, transactions, hooks | `Dexie.js` | — |
| Unit + integration test setup, mocking, snapshots | `vitest` | `testing-library-docs` |
| DOM / hook / accessibility-aware tests | `testing-library-docs` | `vitest` |
| Service Workers, runtime caching, offline strategy | *(deferred — clone PWA docs first)* | — |
| PWA manifest / service-worker integration via Vite | *(deferred — clone PWA docs first)* | — |
| Underlying Web APIs (IndexedDB, Service Worker, Cache, etc.) | *(deferred — `mdn-content` not yet cloned)* | — |

If a task spans categories (e.g., "build an offline-capable form that persists to Dexie"), pull from each relevant row, not from every doc in the table.

## Hard rules for this folder

1. **Do not commit** anything inside `reference/vendor-docs/`. The folder is gitignored. If git ever shows changes inside it, that means the gitignore is broken — fix the gitignore, do not commit the clone.
2. **Do not copy code** from a vendor-docs clone into `src/` unless you have an explicit, attributed reason and the license allows it. Prefer rewriting in FieldLog's own style.
3. **Do not refactor product code as a side effect** of reading a vendor doc.
4. **Do not treat vendor examples as FieldLog architecture**. Vendor examples illustrate library usage in isolation. FieldLog has additional invariants (offline-first, immutable submissions, manager review, append-only event log) that override generic patterns.

## AI Agent Usage Rules

When using vendor docs to inform code changes:

- **Consult only the relevant docs for the task at hand.** Use the table above to choose 1–3 folders, not the whole tree.
- **Do not ingest all vendor docs blindly.** Bulk reading wastes context and dilutes signal. Open specific files.
- **Do not invent APIs from memory when local official docs are available.** If you'd cite a method or option from training data, verify it against the local clone first.
- **Prefer official docs and examples over random patterns.** When the local clone shows a canonical pattern, use it instead of a remembered StackOverflow-style snippet.
- **Summarize the relevant vendor-doc findings before making large code changes.** State what the docs say and which file/section you read it in, then propose the change. This makes the reasoning auditable.
- **Keep FieldLog-specific invariants dominant over framework examples.** When a vendor pattern conflicts with a FieldLog invariant — e.g., a Dexie example that mutates a record in place vs. our append-only event model, or an MUI form pattern that bypasses RHF/Zod — the FieldLog invariant wins. Flag the conflict explicitly rather than silently choosing the framework default.

## Context Control Rule

Vendor-docs clones are large. Loading them carelessly will swamp the model's context and crowd out the FieldLog code that the task is actually about.

- **Open specific files, not directories.** When consulting `material-ui` or `vite`, navigate to the precise doc page (e.g., `material-ui/docs/data/material/components/autocomplete/autocomplete.md`), not the whole `docs/` tree.
- **Quote, don't paste.** Cite the file path and the few lines that matter. Never paste a long doc verbatim into the working conversation.
- **Drop the doc once you've used it.** Don't keep large vendor files resident across unrelated steps; re-open them only when the next task needs them.
- **Never let vendor docs outweigh FieldLog files in context.** If you find yourself loading more vendor-doc content than FieldLog source for a single task, you are reading too widely — narrow the question first.
- **Search before you read.** Use grep over the relevant clone to locate the smallest snippet that answers the question, instead of reading top-down.
- **Vendor-docs clones are read-only inputs.** Never edit, lint, or "fix" files inside `reference/vendor-docs/` — they are not ours.

## Dependency Version Rule

The cloned upstream defaults to its main branch. That HEAD usually does **not** match the version FieldLog has installed. Following the wrong version leads to APIs that don't exist in our build.

- **Anchor on the installed version.** Before quoting an API, check `package.json` (and `package-lock.json` for the resolved version) for the dep, then verify the doc/source you're reading describes that major version. If the clone is on a newer major, look for a `docs/` subfolder, branch, or tag matching the installed major.
- **Flag version drift explicitly.** If the cloned doc describes a different major than what we have installed, say so before recommending the API. Example: "The `react.dev` clone documents React 19; we have React 19 installed — match." Or: "The `material-ui` clone is on v7; we have v9 installed — verify v9 docs separately before relying on this."
- **For breaking-change-prone areas, double-check.** RHF, Zod, MUI, and Dexie have all had breaking releases. For these, verify the version explicitly, not just optimistically.
- **Pinning is not automatic.** `--depth 1` of the default branch is what the script gives you. If you need version-pinned docs, check out the matching tag inside the clone manually (e.g., `cd reference/vendor-docs/zod && git fetch --depth 1 origin v3.x.x && git checkout FETCH_HEAD`). Note this in the change you're making so future readers know which version informed it.
- **When in doubt, prefer the installed package's bundled types.** `node_modules/<pkg>/dist/*.d.ts` is the ground truth for the version we actually run; the cloned upstream is supplementary.

## Core invariants to remember (do not violate from a vendor example)

- FieldLog is **not** a legal authorization engine. Do not infer compliance decisions from vendor patterns.
- Submitted contractor records are **immutable**.
- Manager actions (review, accept, request correction, lock) are **append-only events**, not silent edits to contractor inputs.
- **Offline drafts and submissions** must preserve timestamps and actor/device context.
- **Locked records** are export-stable and reproducible.
- **Domain models do not depend on React.**
- **Persistence is mediated** behind service/repository layers; UI never opens Dexie directly.
- **UI never mutates** submitted or locked records.
