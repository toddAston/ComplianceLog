# FieldLog — Remaining Work

Full gap analysis: what's left to ship between today's prototype and a working, paid-customer product. Grounded in:

- `docs/product/fieldlog_design_model_v0_1.json` — canonical domain
- `docs/00_FieldLog Overview.pdf` — product overview + differentiators
- `docs/08_final-refinement-report_v1.pdf` — validated business canvas
- `docs/09_traction-roadmap_v1.pdf` — pilot/Q2/Q3 milestones
- `docs/06_feasibility-validation-report_v1.pdf` — technical feasibility
- Current `src/` tree and 73 passing tests

Three tiers: **MVP gap** (blocks pilot), **pre-launch hardening** (blocks paid customers), **Year-2 horizon** (post-traction).

---

## Built today (golden-path skeleton)

In-browser, single-tab prototype on Dexie/IndexedDB. Domain-correct lifecycle works end-to-end:

- Zod-derived domain types; Dexie store + seed data
- Contractor draft form → submit → frozen ProductSnapshot
- Manager review: accept+lock OR request correction (immutable contractor inputs preserved)
- Contractor resubmit flow with diff event after correction
- 4-rule compliance engine (wind, pest, timing, RUP) gating submit with Missouri citations
- RecordDetailDialog + AuditReport print view + JSON export DTO
- Append-only event log with full chain-of-custody
- 73 tests passing; plain-HTML UI on MUI deps (installed but mostly unused)

---

## 🟠 MVP Gap (blocks pilot launch)

These are the things that block "a real contractor in a real field can do this on a real phone, offline, in June 2026." Per `09_traction-roadmap` Q1 milestone.

### Item 1: PWA / offline-first foundation

- [ ] **Add web app manifest** — `public/manifest.webmanifest` with name/icons/theme_color/standalone; link from `index.html`.
- [ ] **Add app icons** — 192/512 PNG + maskable 512 in `public/icons/`; apple-touch-icon for iOS install.
- [ ] **Wire vite-plugin-pwa with Workbox precache** — install plugin, configure `injectManifest` in `vite.config.ts`, `registerType: 'prompt'`.
- [ ] **Author service worker shell** — `src/sw.ts` with precache, `clients.claim()`, NetworkFirst for `index.html`.
- [ ] **Register service worker on app boot** — `src/pwa/registerSW.ts` invoked from `main.tsx`; expose `onNeedRefresh`/`onOfflineReady`.
- [ ] **Add cache versioning + update prompt** — bump `cacheNames` per build, MUI Snackbar prompt, `updateSW({reloadPage:true})`.
- [ ] **Add offline indicator UI** — `src/ui/system/OfflineBadge.tsx` driven by `navigator.onLine`; mount in app header.
- [ ] **Register Background Sync tag for outbox** — `fieldlog-outbox` tag; SW posts message to clients to drain outbox.

### Item 2: Backend + auth + multi-device sync

Assume Supabase (Postgres + Auth + RLS + Storage) to skip writing a server.

- [ ] **Provision Supabase project + env wiring** — `.env.local`, install `@supabase/supabase-js`, singleton client.
- [ ] **Author Postgres schema migration** — mirror `domain/types.ts`: orgs, org_members, application_records, events, product_snapshots.
- [ ] **Enable RLS policies for org tenancy** — every table scoped to `org_id IN (select org_id from org_members where user_id = auth.uid())`.
- [ ] **Implement email/password auth UI** — Login + Signup pages; session bootstrap; protected-route wrapper.
- [ ] **Add manager invite flow** — Edge Function calling `inviteUserByEmail`; `org_members` row on accept.
- [ ] **Replace DEMO actor context with real session** — derive `ActorContext` from Supabase session + role.
- [ ] **Add Dexie outbox table** — `{id, entity, entityId, op, payload, attempts, lastError, createdAt}`.
- [ ] **Implement outbox drain worker** — FIFO with exponential backoff; transitions queued→syncing→synced|sync_failed.
- [ ] **Implement pull sync** — fetch records+events since `lastPulledAt`; upsert without overwriting unsynced local edits.
- [ ] **Define conflict policy for draft contractorInputs** — last-write-wins per field by server `updated_at`; locked records reject foreign writes.
- [ ] **Server-side role enforcement check** — RLS/function gating status_transition events to `role='manager'`.
- [ ] **Per-org data isolation tests** — two seeded users in different orgs; assert no cross-org reads/writes.

### Item 3: Audit-ready PDF export

- [ ] **Pick PDF library** — evaluate pdf-lib vs jsPDF; commit choice in `applicationRecordPdf.ts` skeleton.
- [ ] **Extract APPRIL layout reference** — capture target layout from `APPRIL_User_Guide_Public.pdf` in a TS const map.
- [ ] **Implement PDF renderer skeleton** — 1-page letter-size with header + record id + locked-at; prove Blob download in jsdom.
- [ ] **Render all record sections** — applicator, farm/field, product snapshot, application details, weather, status history.
- [ ] **Wire "Download PDF" button into DraftsList** — locked/exported rows only; preserve existing JSON DTO export.
- [ ] **Append PDF export event** — `pdf_exported` event through the service layer.

### Item 4: Automatic weather capture

- [ ] **Add weather service interface** — `weatherService.ts` with Zod `WeatherReading` schema.
- [ ] **Implement NWS adapter** — `api.weather.gov/points` → nearest station observation; unit-tested with fetch mock.
- [ ] **Add geolocation helper** — wrap `getCurrentPosition` with timeout + permission-denied + insecure-context fallbacks.
- [ ] **Wire auto-capture into DraftApplicationRecordForm** — populate temp/wind on submit; inline provenance chip.
- [ ] **Manual-override path** — 5s timeout, fall back to manual entry with banner; never block submit.
- [ ] **Snapshot weather onto record** — `weatherSnapshot { source, stationId, observedAt, capturedAt }`; frozen at submit.

### Item 5: Mobile-first UI pass with MUI

- [ ] **Install + theme MUI** — `ThemeProvider` + `CssBaseline`; placeholder theme; 16px base + 44px touch targets.
- [ ] **Migrate DraftApplicationRecordForm controls** — Autocomplete, DatePicker/TimePicker, RadioGroup per design model JSON.
- [ ] **Update form tests to MUI selectors** — replace `fireEvent.change` with `userEvent` + role/label queries.
- [ ] **Responsive form layout** — single-column xs, two-column md+ via `Grid`/`Stack`; sticky submit bar on mobile.
- [ ] **Migrate DraftsList to MUI Card/List** — Card per record, status Chip, full-card tap target.
- [ ] **Mobile shell polish** — AppBar with status filter, bottom thumb-reach padding, MUI Snackbar for toasts.

### Item 6: EPA product catalog ingestion

- [ ] **Inspect source data** — script dumps headers + row counts of `2024-cdr-public-csv-data/` and `apprildatadump_public.xlsx`.
- [ ] **Decide local-bundled vs remote** — pick local JSON for offline-first; <5MB gzipped MO subset budget.
- [ ] **Build ingestion script** — `scripts/build-product-catalog.ts` → `src/data/product-catalog.v2024.json`.
- [ ] **Add catalog loader service** — lazy-load JSON, `searchProducts(query)`, in-memory index <50ms.
- [ ] **Replace seed Product with catalog** — populate Dexie products from bundled catalog on first run.
- [ ] **Wire Autocomplete + RUP/signal-word display** — color-coded chips below product selection.

### Item 7: Pilot-realistic seed content

- [ ] **Curate Missouri product seed list** — ~25 commonly-applied MO products for demos.
- [ ] **Build FarmList + FarmForm (manager)** — MUI list with create/edit; service-layer CRUD; no delete.
- [ ] **Build FieldList nested under farm** — field create/edit with acres + crop; FK to farm.
- [ ] **Build ContractorList + invite stub** — local-only join code (real invite deferred to Item 2).
- [ ] **First-run onboarding wizard** — org → manager → first farm → first field → first contractor invite.
- [ ] **Replace demo seed loader** — gate "Example Herbicide 4L" behind dev-only flag; pilot builds start empty.

---

## 🟡 Pre-launch Hardening (Q2–Q3 roadmap)

These block paid customers, not pilots. Roadmap calls for 5–8 paying customers by Oct 2026.

### Item 8: Account & access control

- [ ] **Build sign-up page with email/password** — `/signup` route, redirect to verify-email.
- [ ] **Wire email verification flow** — Supabase confirm redirect, resend-link button.
- [ ] **Build sign-in + password reset pages** — `/signin`, `/forgot-password`, `/reset-password`.
- [ ] **Add organizations schema + membership** — first signup auto-creates org and assigns manager role.
- [ ] **Implement manager-invites-contractor flow** — `org_invites` table with token, accept-invite landing.
- [ ] **Write RLS policies for per-org isolation** — Vitest integration test that user-A can't read org-B rows.
- [ ] **Add audit_log table + access logging hook** — `user_id`, `record_id`, `action`, `ts` per read/write.
- [ ] **Add soft-deactivation flag on org_members** — `deactivated_at`; preserve prior records.

### Item 9: Billing

- [ ] **Add Stripe product + price IDs for tiers** — $50/$75/$125 tiers; commit to `src/billing/plans.ts`.
- [ ] **Add subscriptions table + pilot_until column** — plan, status, current_period_end, seat_limit; pilot bypasses Stripe.
- [ ] **Build checkout entry page** — `/billing/upgrade` → edge function creates Stripe Checkout session.
- [ ] **Implement Stripe webhook edge function** — handle `checkout.session.completed`, subscription updated/deleted.
- [ ] **Enforce seat limits on invite** — block invites at limit unless pilot flag active.
- [ ] **Build billing portal page** — `/billing` with plan, seats, "Manage in Stripe", invoice list.

### Item 10: Manager dashboard

- [ ] **Build ManagerDashboard route shell** — `/manager` guarded by role; replaces shared DraftsList.
- [ ] **Add status + contractor + farm + date-range filter bar** — URL-synced query params.
- [ ] **Add counts widget** — pending_review, needs_correction, locked-this-week chips at top.
- [ ] **Add SLA aging badge on row** — red >3d, yellow >1d for pending_review.
- [ ] **Add search input** — applicator/EPA reg #/product; debounced.
- [ ] **Add sort controls** — submitted_at, application_date, contractor; persisted in URL.
- [ ] **Add bulk export to ZIP** — date-range, batch PDFs via JSZip, progress indicator.

### Item 11: Contractor experience

- [ ] **Build "My submissions" view** — scoped to current user; inline status badges.
- [ ] **Surface needs_correction reason inline** — expandable row showing manager note from events.
- [ ] **Add "Resubmit" CTA on needs_correction rows** — prefilled form via existing service path.
- [ ] **Add saved-equipment list** — `saved_equipment` table; picker in form; "save this equipment" toggle.
- [ ] **Add "Clone last submission" action** — duplicate latest record for field+product, today's date, cleared signatures.

### Item 12: Data integrity & ops

- [ ] **Verify Supabase PITR enabled + document restore runbook** — test restore to staging.
- [ ] **Add Sentry client SDK** — wrap `main.tsx`; source maps in Vite build; env-gated DSN.
- [ ] **Add Sentry to Supabase edge functions** — webhook + invite handlers.
- [ ] **Integrate PostHog with activation event** — `record_submitted`; cohort = ≥1 submit within 7d of signup.
- [ ] **Build sync-conflict resolution UI** — diff dialog on server-newer; re-stage local changes.
- [ ] **Add /status health-check endpoint** — edge function pinging DB; public consumer page.
- [ ] **Define log retention policy** — Sentry 30d, PostHog 12mo, audit_log 7y per FIFRA; `docs/ops/retention.md`.

### Item 13: Compliance engine maturation

- [ ] **Add ruleVersion to record snapshot** — alongside catalogVersion; display on detail view.
- [ ] **Extract rules into versioned rule-pack module** — `src/application/rulePacks/missouri-v1.ts`; registry by state.
- [ ] **Define state-rule-pack interface** — `RulePack { state, version, rules: Rule[] }`; loader picks from org settings.
- [ ] **Add label-derived restrictions to product catalog** — `phi_days`, `rei_hours`, `max_rate`, `wind_ceiling_mph`.
- [ ] **Wire label restrictions into rule engine** — new rules consuming product fields; cite product label.
- [ ] **Add Worker Protection Standard fields to form** — `rei_posted`, `workers_notified`; required when product has REI.
- [ ] **Surface rule citations in RecordDetailDialog** — render `rule.citation` next to violation/warning chips.

### Item 14: Legal & policy

- [ ] **Add ToS + Privacy + DPA static pages** — `/legal/terms`, `/legal/privacy`, `/legal/dpa`.
- [ ] **Add disclaimer footer component** — global footer linking to overview disclaimer language.
- [ ] **Add disclaimer to submit confirmation modal** — checkbox-acknowledged before final submit.
- [ ] **Add disclaimer to export PDF cover page** — header block on generated PDFs.
- [ ] **Add cookie/analytics consent banner** — gates PostHog init; persists choice in localStorage.
- [ ] **Add data-retention enforcement job** — scheduled edge function; FIFRA 2y minimum + state overrides.
- [ ] **Build account-deletion + data-export request page** — `/account/privacy`; export JSON zip; deletion creates ticket.

---

## 🔵 Year-2 Horizon (post-traction)

Quarter-scale chunks, not commit-scale. Don't build until paying customers + the Week-4 partnership gate are cleared.

### Item 15: Native iOS/Android apps

- [ ] **Decide on native strategy** — React Native vs Capacitor vs fully native; tradeoff matrix.
- [ ] **Migrate offline storage to SQLite** — replace Dexie behind service layer.
- [ ] **Ship app store builds** — Apple Developer + Play Console; signing/entitlements; first-review prep.
- [ ] **Wire native push entitlements** — APNs + FCM token registration.
- [ ] **Set up native CI** — EAS Build or Fastlane; TestFlight + internal Play track.

### Item 16: Photo capture on records

- [ ] **Add photo capture UI** — label/field/equipment slots; thumbnail preview.
- [ ] **Implement offline photo queue** — Dexie blob → Supabase Storage with retry/backoff.
- [ ] **Preserve EXIF for chain of custody** — sidecar metadata at shoot time.
- [ ] **Enforce photo immutability on lock** — append-only references post-Submitted.
- [ ] **Render photos in export bundle** — full-res + thumbnails + EXIF in PDF/JSON packets.

### Item 17: GPS field boundary capture / acres auto-calc

- [ ] **Build walk-the-perimeter capture** — background geo, breadcrumb trail, accuracy filter.
- [ ] **Persist polygon on FieldSite** — GeoJSON + capture metadata; Dexie migration.
- [ ] **Auto-derive acres from polygon** — geodesic area calc; default `acresTreated` with "auto" badge + override.
- [ ] **Add map + applied-area overlay** — MapLibre/Leaflet with cached offline tiles.

### Item 18: Drift complaint workflow

- [ ] **Model Dispute as immutable record type** — own event-append lifecycle.
- [ ] **Build dispute thread UI** — manager/regulator post timestamped notes + attachments.
- [ ] **Wire role-scoped views** — manager edit, regulator read+comment, contractor read-only.
- [ ] **Extend export bundle for disputes** — record + snapshot + thread + attachments.
- [ ] **Notify contractor on dispute open** — via Item 21 channels; complainant identity protected.

### Item 19: Multi-org / multi-farm switching for contractors

- [ ] **Model org membership** — N orgs per user with role per org; active-org provider.
- [ ] **Build org switcher UI** — nav dropdown, persists per device, clears form drafts on switch.
- [ ] **Scope product catalog by org** — merged view, but resolution snapshots against destination org.
- [ ] **Route submissions to correct manager feed** — submission carries org id; dashboard scoped.

### Item 20: Consultant portal

- [ ] **Add Consultant role + grant model** — per-consultant grant with scope + expiry.
- [ ] **Build read-only consultant dashboard** — branded "your consultant" view; no mutation endpoints.
- [ ] **Enable export-only actions** — same export bundles managers see.
- [ ] **Manager grant management UI** — invite by email, set scope, revoke; audit log of grants.

### Item 21: Notifications (SMS + email)

- [ ] **Add notification service abstraction** — single dispatcher with channel adapters.
- [ ] **Trigger correction-request SMS** — deep-link back into contractor's record.
- [ ] **Send manager daily digest email** — scheduled function aggregating PendingReview per org.
- [ ] **Build notification preferences UI** — per-user channel toggles, quiet hours, opt-in per event-type.
- [ ] **Implement opt-out compliance** — STOP keyword for SMS, unsubscribe + suppression list, TCPA/CAN-SPAM posture documented.

### Item 22: Third-party integrations

- [ ] **Define integration pattern** — read-only export-first, OAuth per partner, `src/integrations/<partner>/`.
- [ ] **Ship Climate FieldView export** — map ApplicationRecord + snapshot to FieldView schema.
- [ ] **Ship John Deere Operations Center export** — same shape against JD Ops API.
- [ ] **Ship Granular export** — third adapter reusing shared mapping utilities.
- [ ] **Build integration management UI** — per-org enable/connect/disconnect, token refresh, sync status.

### Item 23: State expansion packs beyond Missouri

- [ ] **Refactor MO rules into state-pack module** — `src/application/state-packs/mo/` with uniform `StatePack` interface.
- [ ] **Add state-pack registry + loader** — lazy-load by state code; per-org enabled set.
- [ ] **Filter product catalog per state** — state-restricted product hides/warnings at query time.
- [ ] **Add admin UI for pack toggles** — affects form validation + catalog scope.
- [ ] **Author test fixtures per state** — Vitest fixture suite proving citation + restriction behavior.

### Item 24: Lender-facing export

- [ ] **Design lender summary format** — operations-level PDF distinct from EPA audit packet.
- [ ] **Add time-windowed export generator** — quarter/custom range; locked records only.
- [ ] **Support per-lender branding** — configurable header/logo/footer per share.
- [ ] **Generate time-bound share links** — token-gated, expiry + max-downloads; no lender login.
- [ ] **Log lender access events** — append download events to originating org's audit log.

---

## Totals & sequencing

**~140 tasks across 24 items:**

- MVP gap: ~50 tasks before pilot can run
- Pre-launch hardening: ~45 tasks before paid customers
- Year-2 horizon: ~45 quarter-scale chunks

**Hard sequencing constraints** (what blocks what):

- Item 2 (backend) gates all of 8, 9, 10's bulk-export, 11's saved data, 12's PostHog cohort, 21's notifications.
- Item 6 (catalog) gates 13's label-derived restrictions and 23's state filtering.
- Item 1 (PWA) and Item 5 (mobile MUI) can run in parallel with Items 3/4/6.
- Item 15 (native) replaces Item 1 — only one will ship long-term.
