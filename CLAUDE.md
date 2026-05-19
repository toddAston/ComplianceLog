# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project
FieldLog (repo: ComplianceLog) — mobile-first, offline-capable pesticide application recordkeeping for agricultural operations.

# Mission
Offline-first immutable pesticide application evidence capture system.

# Project Status
v0.1 — design/specification phase. The repo is **pre-scaffold**: no Vite/React app exists yet. `src/` currently holds only `src/ui/application-record/ApplicationRecordForm.ts` (a type-only sketch of the contractor form). When asked to implement features, expect to scaffold the Vite + React + TS app first; the design docs (below) are the source of truth for what to build, not the current code.

# Source-of-Truth Documents
Read these before designing or implementing — they define the domain and are more complete than the code:
- `docs/product/fieldlog_design_model_v0_1.json` — canonical form fields, controls, required rules, workflow/sync statuses, domain model, v0.1 table list.
- `docs/architecture/reproducible-design/fieldlog_reproducible_design_v0_1.md` — full design snapshot with field-level tables.
- `docs/architecture/diagrams/fieldlog_mermaid_diagrams_v0_1.mmd` — golden path flowchart, lifecycle state diagram, ERD.
- `docs/domain/examples/application_record_v01.json` — example record instance.
- `FieldLog Development Blueprint.md` (root) — regulatory analysis and feature design.
- `research/regulatory/` — Missouri/EPA source PDFs (APPRIL guides, RUP report). Do not commit derived/large data files into the repo (`data/raw/epa/apprildatadump_public.xlsx` is gitignored at 98 MB).

When the design docs and the code disagree, the docs win — flag the divergence rather than silently aligning the docs to the code.

# Product Constraints
- Mobile-first
- Offline-first
- Contractors submit immutable records
- Managers review/lock but do not silently alter submissions
- NOT a legal authorization engine — captures evidence, does not adjudicate compliance
- Preserve chain of custody

# Tech Stack
- Vite + React + TypeScript (not yet scaffolded)
- MUI for UI controls (the design model specifies MUI control names per field, e.g. Autocomplete, DatePicker)
- Dexie / IndexedDB for offline persistence
- React Hook Form for form state
- Zod for schema validation
- Vitest + @testing-library/react + jsdom (already installed)

# Architecture Rules
- Domain-first organization (folders by domain, e.g. `application-record/`, `product-catalog/`, not by tech layer).
- No direct IndexedDB / Dexie calls from UI components — go through a service layer.
- Service layer mediates persistence and is the only place that touches Dexie.
- Zod schemas are the source of truth — derive TS types from Zod, not the other way around.
- Immutable event-append model preferred for record history. The lifecycle is `Draft → Submitted → PendingReview → (Accepted | NeedsCorrection) → Locked → Exported`; corrections re-enter Draft. Status transitions should be appended as events on `application_record_events`, not mutate prior state.
- A submitted Application Record carries a **Product Snapshot** (frozen copy of the product/EPA reg # at submit time) so a later catalog update cannot retroactively alter what was applied.
- Sync status is independent of workflow status (`Local Only | Queued | Syncing | Synced | Sync Failed`).

# Coding Rules
- Minimal diffs. Reuse existing patterns before introducing abstractions.
- No unnecessary dependencies; no massive refactors unless requested.
- Default to no comments; only add a comment when the *why* is non-obvious.

# Current MVP Goal
Golden path:
draft → submit → product snapshot → manager review → lock → export

# Commands
No build/lint/dev scripts are defined yet — `package.json` only declares vitest devDependencies. When scaffolding Vite, add the standard scripts (`dev`, `build`, `preview`, `test`, `lint`, `typecheck`) under `scripts`.

Once vitest is wired up:
- Run all tests: `npx vitest`
- Run a single test file: `npx vitest run path/to/file.test.ts`
- Run tests matching a name: `npx vitest -t "pattern"`
- Watch mode: `npx vitest` (default) — single-run with `npx vitest run`.

# Git / Repo Conventions
- Default branch is `main`. Remote is `origin` → `https://github.com/toddAston/ComplianceLog`.
- The 98 MB EPA xlsx (`data/raw/epa/apprildatadump_public.xlsx`) is gitignored intentionally; if a similar large file appears, gitignore it rather than committing.
- `package-lock.json` is tracked for reproducible npm installs. `yarn.lock` and `pnpm-lock.yaml` remain gitignored unless the package manager changes.
