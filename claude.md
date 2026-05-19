# Project
FieldLog

# Mission
Offline-first immutable pesticide application evidence capture system.

# Product Constraints
- Mobile-first
- Offline-first
- Contractors submit immutable records
- Managers review/lock but do not silently alter submissions
- NOT a legal authorization engine
- Preserve chain of custody

# Tech Stack
- Vite
- React
- TypeScript
- MUI
- Dexie/IndexedDB
- React Hook Form
- Zod

# Architecture Rules
- Domain-first organization
- No direct IndexedDB calls from UI
- Service layer mediates persistence
- Zod schemas are source of truth
- Immutable event append model preferred

# Coding Rules
- Minimal diffs
- Reuse patterns before abstraction
- No unnecessary dependencies
- No massive refactors unless requested

# Current MVP Goal
Golden path:
draft -> submit -> product snapshot -> manager review -> lock -> export