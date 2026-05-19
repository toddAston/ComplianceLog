# First Build Steps in Order

Do this in this order. **Do not start with the form UI.**

## Step 1 — Create project and install packages

```bash
npm create vite@latest fieldlog -- --template react-ts
cd fieldlog

npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install dexie dexie-react-hooks
npm install zod react-hook-form @hookform/resolvers
```

## Step 2 — Add these files

- `src/domain/types.ts`
- `src/db/fieldlogDb.ts`
- `src/db/seed.ts`
- `src/db/applicationRecordService.ts`

Get the database compiling first.

## Step 3 — Add a temporary database debug screen

Before building the real form, create a page that proves the seed data exists.

You need to see:

- Organization: `Southeast Missouri Farms Demo`
- Farm: `North Farm`
- Field: `Field 7`
- Applicator: `John Smith`
- Product: `Example Herbicide 4L`

This validates Dexie and seed setup.

## Step 4 — Create a hardcoded draft button

Do not build the form yet.

Make a button: **Create Demo Draft**

It should create one complete `ApplicationRecord` using the seeded farm, field, applicator, and product.

## Step 5 — Create submit button

On a draft record, show: **Submit Record**

Clicking it must:

- change `workflowStatus` to `pending_review`
- set `syncStatus` to `queued`
- create `ProductSnapshot`
- add `submitted` event
- add `product_snapshot_created` event

This is the core evidence-capture moment.

## Step 6 — Create manager review view

Show all records where `workflowStatus === "pending_review"`.

Then add: **Accept & Lock**

Clicking it must:

- create review
- change `workflowStatus` to `locked`
- set `lockedAt`
- add `reviewed` event
- add `locked` event

## Step 7 — Create locked record view

Show the final audit-style record as read-only.

Minimum sections:

- Applicator
- Field / Site
- Product Snapshot
- Application Details
- Weather / Conditions
- Attestation
- Manager Review
- System Audit Metadata
- Event Log

This is your demo payoff.
