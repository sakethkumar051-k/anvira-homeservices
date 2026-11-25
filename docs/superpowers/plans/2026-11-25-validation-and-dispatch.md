# Validation and Automatic Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Explain blocked actions and route paid bookings to eligible internal workers or outside professionals with clear exceptions.

**Architecture:** Extend existing transactional office dispatch rather than introduce a second matching system. Shared validation helpers drive field errors; the simulator runs real matching/offer/worker logic against isolated in-memory data. Existing manual mode remains compatible.

**Tech Stack:** Expo 58, React Native 0.88, React 19, Express, SQLite/Firestore, existing push outbox.

**Spec:** docs/superpowers/specs/2026-11-25-validation-and-dispatch-design.md

## Global Constraints
- English and Telugu; no new native dependencies.
- Never simulate against live data or send external notifications from the simulator.
- Retain owner approvals for refunds and payouts. No automatic cancellation added.
- Retain original manual mode by default for existing settings; show an explicit recommended automatic option.
- Preserve unrelated uncommitted work and the running Expo Go server.

## Review Focus
- Capacity changes between payment, offer creation and acceptance must not double-book.
- No candidate or no acceptance must produce an honest actionable exception.
- Missing/invalid quote fields and inaccessible coverage must explain the exact correction.
- Scheduler delays and app closure must not extend the three-minute dispatch deadline.
- Notifications queued/sent/receipt/accepted are different states; do not claim delivery from an outbox record.

### Task 1: Clear form validation
Files: src/lib/form-validation.ts, src/components/ui.tsx, ServiceQuotes.tsx; tests/form-validation.test.mjs and browser validation suite.
- [x] Write and run failing quote validation tests (required answers, 15-character description, 8-character address, six-digit supported PIN, inactive service).
- [x] Implement a shared error map and submit summary; add optional Input error/help and Button disabledReason semantics.
- [x] Replace quote disabled predicates with visible requirements, submit validation and first-field focus.
- [x] Audit other disabled action sites and add precise reasons or actionable validation; verify unchanged backend constraints.

### Task 2: Automatic internal assignment and bounded fallback
Files: server/lib/dispatch.mjs, schemas.mjs, domain.mjs, workers.mjs, server/app.mjs, src/lib/model.ts; tests/office-dispatch.test.mjs.
- [x] Add failing tests for automatic internal assignment, conflict checks, partner batches/retries/deadline and manual compatibility.
- [x] Add preserved internalAssignmentMode setting and apply automatic assignment on payment with existing locks.
- [x] Add bounded rounds, history, reasons and deadline, rechecking eligibility on retries and acceptance.
- [x] Run dispatch and push regression suites, including simultaneous acceptance and stale-policy invalidation.

### Task 3: Understandable admin and professional flow
Files: OfficeDispatchSettings.tsx, StaffBookingActions.tsx, PartnerOffers.tsx, Operations.tsx, dispatch.ts, translations.json.
- [x] Present manual/automatic modes, fallback and explicit availability controls in plain language.
- [x] Show dispatch history, live offer round/deadline, exception reasons and professional offer actions.
- [x] Preserve owner/care boundaries and customer privacy before partner acceptance.

### Task 4: Isolated simulator
Files: server/lib/dispatch-simulator.mjs, server/routes/dispatch.mjs, src/components/DispatchSimulator.tsx; tests/dispatch-simulator.test.mjs.
- [x] Add failing isolation tests and scenarios for internal, external, busy, unavailable, expired, race and failed push.
- [x] Run existing createApplication/business dispatch against isolated memory records and stubbed delivery; return a bounded sanitised timeline.
- [x] Add owner-only admin simulator with a clear simulation label and no live mutations.

### Task 5: Verification and release evidence
- [x] Add browser regressions for monthly quote errors/valid submit, automatic mode, partner alerts and simulator.
- [x] Run lint, typecheck, full unit suite, dispatch/quote/admin/customer browser suites and web/iOS/Android exports.
- [x] Request one fresh scoped review, fix significant findings and record actual release/device-test limits.

## Execution ledger
Ruling: continue in the current workspace — this feature depends on the user's large approved uncommitted admin/mobile changes; a clean worktree would omit the product being refined.
Ruling: user approval of the presented plan authorizes native execution without another confirmation.

Implementation ledger: validation helpers/UI, transactional auto-routing, bounded offer rounds, service/PIN pauses, readable inspector, isolated simulator, independent scheduler and paginated roster matching are implemented. Failing tests reproduced the initial blockers, queue starvation, slow-push blocking, lost wake and overdue batch issues; each now passes. Fresh review reported no remaining significant findings. Lint/typecheck and 385 tests pass; customer/office/new dispatch browser suites pass; web/iOS/Android exports complete. Matching Firestore indexes deployed through the ANVIRA account; hosted code and APK rollout are in progress.

Hosted ledger: matching backend and Firestore indexes deployed; six hosted isolated simulations passed; approved automatic routing saved and read back. Android preview build 8 completed. Website promotion, final API proxy verification and emulator/full-CI outcomes remain tracked in AUTOMATIC-DISPATCH-REVIEW.md. Physical-device push is not certified.
