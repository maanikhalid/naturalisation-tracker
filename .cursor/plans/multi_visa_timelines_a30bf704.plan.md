---
name: Multi Visa Timelines
overview: Introduce multi-form timeline support with strict data isolation via separate models/tables and dynamic form routes, while preserving naturalisation as the homepage default until a future landing-page switch.
todos:
  - id: add-form-routing-shell
    content: Introduce dynamic `/form/[formSlug]` page and keep homepage naturalisation-first.
    status: pending
  - id: split-prisma-models
    content: Create separate Prisma models/tables per form and migrate existing naturalisation data to `TimelineEntryAN`.
    status: pending
  - id: create-form-registry
    content: Implement central form registry and repository abstraction to route all reads/writes to the correct model.
    status: pending
  - id: scope-api-by-form
    content: Add form-scoped public/admin API routes and keep temporary compatibility shims.
    status: pending
  - id: add-form-navigation
    content: Implement header form dropdown linking to each form section while preserving current homepage behavior.
    status: pending
  - id: harden-with-tests
    content: Add leakage-prevention tests, route validation tests, and migration verification checks.
    status: pending
isProject: false
---

# Multi-Visa Timeline Rollout Plan

## Goals
- Add independent timeline sections for multiple forms/visas (e.g. Form AN, visit visa, student visa, spouse visa).
- Prevent data conflicts by storing each form in separate database models/tables.
- Keep naturalisation as the default homepage experience for now.
- Introduce a form switcher menu to navigate across form sections.

## Current-State Constraints
- Routing is currently single-form and homepage-centric in [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx).
- Timeline storage is a single `TimelineEntry` model in [`/Users/khalid/Code/Github/naturalisation-tracker/web/prisma/schema.prisma`](/Users/khalid/Code/Github/naturalisation-tracker/web/prisma/schema.prisma).
- Public and admin endpoints are form-agnostic but implicitly naturalisation-only in [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/timeline/route.ts`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/timeline/route.ts) and [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/admin/entries/route.ts`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/admin/entries/route.ts).

## Target Architecture
```mermaid
flowchart LR
  user[User]
  home[/]
  formRoute[/form/formSlug]
  config[FormRegistry]

  user --> home
  user --> formRoute
  home -->|defaultNaturalisation| formRoute
  formRoute --> config

  config --> anRepo[FormANRepository]
  config --> visitRepo[VisitVisaRepository]
  config --> studentRepo[StudentVisaRepository]
  config --> spouseRepo[SpouseVisaRepository]

  anRepo --> anTable[(TimelineEntryAN)]
  visitRepo --> visitTable[(TimelineEntryVisitVisa)]
  studentRepo --> studentTable[(TimelineEntryStudentVisa)]
  spouseRepo --> spouseTable[(TimelineEntrySpouseVisa)]
```

## Implementation Phases

### Phase 1: Route Foundation (No UX breaking changes)
- Add dynamic route shell for form pages at [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/form/[formSlug]/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/form/[formSlug]/page.tsx).
- Keep homepage [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx) rendering naturalisation timeline directly (or server-redirect to `/form/an` only if preserving SEO metadata behavior).
- Add canonical links and metadata per form route to avoid duplicate-content issues.

### Phase 2: Data Isolation by Separate Models
- Extend Prisma schema in [`/Users/khalid/Code/Github/naturalisation-tracker/web/prisma/schema.prisma`](/Users/khalid/Code/Github/naturalisation-tracker/web/prisma/schema.prisma) with separate models:
  - `TimelineEntryAN`
  - `TimelineEntryVisitVisa`
  - `TimelineEntryStudentVisa`
  - `TimelineEntrySpouseVisa`
- Keep model fields aligned initially for faster rollout; permit divergence later when visa milestones differ.
- Add migration and backfill script to copy existing `TimelineEntry` naturalisation data into `TimelineEntryAN`.
- Freeze writes to legacy `TimelineEntry` after cutover; keep read-only temporarily for rollback.

### Phase 3: Form Registry + Repository Layer
- Create a `form registry` mapping `formSlug -> labels, status options, repository` in a shared config module (new file under `web/src/lib/`).
- Add repository functions per form table (fetch timeline rows, submit row, stats, admin CRUD) so page/API code does not branch directly on Prisma model names.
- Refactor current direct Prisma calls in:
  - [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/page.tsx)
  - [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/data/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/data/page.tsx)
  - [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/admin/page.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/admin/page.tsx)
  to use registry + repositories.

### Phase 4: API Surface Per Form
- Introduce form-scoped API routes (recommended):
  - `/api/form/[formSlug]/timeline`
  - `/api/form/[formSlug]/stats`
  - `/api/admin/form/[formSlug]/entries`
- Keep old `/api/timeline` endpoint as compatibility shim for Form AN during transition.
- Move validation to per-form schemas in [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/lib/validation.ts`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/lib/validation.ts) (shared base + form-specific extensions).

### Phase 5: Navigation and UX
- Update header menu in [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/components/site-header.tsx`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/components/site-header.tsx) to include a form selector/dropdown linking to each `/form/[formSlug]` page.
- Keep homepage copy focused on naturalisation for now, with secondary menu access to other forms.
- Future-ready: add a feature flag/env toggle to switch homepage from “naturalisation-first” to “form picker” later.

### Phase 6: Admin + Import Pipelines
- Make admin dashboard form-aware with explicit form context selector and scoped CRUD.
- Duplicate/adapt Reddit/source ingestion logic for each form where applicable:
  - existing import logic in [`/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/admin/reddit-sync/route.ts`](/Users/khalid/Code/Github/naturalisation-tracker/web/src/app/api/admin/reddit-sync/route.ts)
  - existing script [`/Users/khalid/Code/Github/naturalisation-tracker/web/scripts/import-form-an-spreadsheet.mjs`](/Users/khalid/Code/Github/naturalisation-tracker/web/scripts/import-form-an-spreadsheet.mjs)
- Ensure ingestion routes always target a single table based on selected form.

### Phase 7: Testing and Safety Gates
- Add route tests for valid/invalid `formSlug` behavior (`404`/fallback handling).
- Add API tests that assert zero cross-form leakage (querying one form never returns another form’s rows).
- Add migration verification script/check: row counts before/after for naturalisation cutover.
- Add admin regression checks for edit/remove across all form tables.

## Rollout Strategy
- Step 1: Deploy schema + repositories behind feature flag.
- Step 2: Enable `/form/an` and keep `/` naturalisation default.
- Step 3: Enable visit/student/spouse pages in menu after initial seed data.
- Step 4: Monitor and then deprecate legacy `TimelineEntry` paths.

## Key Design Decisions Locked
- Data isolation: separate table/model per form (no mixed pool).
- Routing baseline: dynamic `/form/[formSlug]` pattern.
- Product behavior now: homepage remains naturalisation-first.
- Product behavior later: homepage can become form selector without redoing backend architecture.