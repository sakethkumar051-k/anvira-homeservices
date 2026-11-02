# Office Dispatch Implementation Plan

> For agentic workers: use the execution workflow task by task; independent files may be developed concurrently. The user requested continuous implementation in this run.

**Goal:** Make office-managed internal fulfilment and Owner-gated first-accept partner fallback usable for client review.
**Architecture:** Extend the existing booking transaction and professional capacity records with a dispatch state and private partner offers. Keep price/payment/commission snapshots and legacy jobs compatible.
**Tech stack:** Expo 57 / React Native 0.86, Expo Router, TypeScript, Express, SQLite / Firestore, Expo Notifications.
**Spec:** `docs/superpowers/specs/2026-11-01-office-dispatch-design.md`.

## Global constraints

- No paid deployment services/payment method; Razorpay remains TEST; no live payout enablement.
- Existing review branch `codex/marketplace-completion`, clean base `5dc5781`, baseline 191 tests pass.
- Preserve owner/care roles and current visual design. Business configuration lives on the Owner website.
- Expo API changes require SDK 57 official docs. No hand-authored native projects or new dependencies without need.
- Partner offers never expose full customer information before claim; accountless workers receive no auth identities.
- Commission slabs and existing paid booking snapshots do not change.

## Review focus

- Concurrent/stale acceptance and overlapping jobs must never create two winners or double capacity.
- Permission revocation/account disabling after notification must reject claim.
- Staff completion must never credit in-house workers or bypass paid/checklist/laundry guards.
- Delayed/replayed notifications must not ring/open unavailable booking details.
- Mobile staff navigation and validation must remain usable with empty/invalid data and failed requests.

## Task 1: Dispatch domain and API

Files: `server/lib/domain.mjs`, new `server/lib/dispatch.mjs` / `server/routes/dispatch.mjs` as needed, `server/app.mjs`, `server/lib/schemas.mjs`, maintenance section of `server/lib/workers.mjs`, Firestore indexes, targeted tests.

- [ ] Add failing backend tests for Owner settings, accountless roster, paid office queue/holds, staff lifecycle, external permission/capacity gate, safe offer inbox and first-accept races.
- [ ] Implement the exact spec API/fields, preserving legacy automatic mode until explicitly activated. Keep new helpers focused and transaction-safe.
- [ ] Add maintenance attention/expiry handling without applying the legacy professional accept timeout to office jobs.
- [ ] Prove duplicate claim, changed eligibility, cancellation/reschedule/revocation, failed reassignment rollback, internal no-wallet behavior and no customer data leakage.
- [ ] Add required indexes and a meaningful Firestore emulator race case.

## Task 2: Owner and Customer Associate experience

Files: `Welcome.tsx`, `SignIn.tsx`, `StaffPortal.tsx`, `DemoLogin.tsx`, `Shell.tsx`, `Workbench.tsx`, `Operations.tsx` staff/catalog sections, new focused roster/dispatch/settings components. Do not edit `Jobs()` or `Customer.tsx` in parallel with Task 3.

- [ ] Separate mobile Customer / Professional / Staff entry and display Customer Associate / Admin while preserving role authorization.
- [ ] Add accountless worker roster and Owner office-mode/external fallback controls using Task 1 API.
- [ ] Replace narrow staff tables with responsive order cards; make current next action visible.
- [ ] Simplify service basics/draft/publish/advanced fields with clear inline validation and saved/error feedback.
- [ ] Keep full business configuration on web and operational staff functions on mobile. Verify role-specific navigation and denied access.

## Task 3: Customer and partner booking experience (primary agent)

Files: `src/lib/model.ts`, `Customer.tsx`, new `PartnerOffers.tsx` / `StaffBookingActions.tsx`, `Operations.tsx` Jobs-only integration, context polling helpers if required, browser flow tests.

- [ ] Add types for dispatch/settings/worker/offer fields and a pure status/next-step helper with tests.
- [ ] Implement partner inbox, countdown, safe scope/payout preview, accept/decline and recoverable conflict handling.
- [ ] Add staff in-house assign/dispatch/arrive/start/complete controls with existing checklist/laundry safeguards.
- [ ] Clarify customer order progress and office support; never imply a worker needs an app.
- [ ] Exercise full office and partner review stories through browser UI, including unavailable/stale offer cases.

## Task 4: Expiring audible notifications

Files: push section only of `server/lib/workers.mjs`, notification modules, `app.config.ts`, sound asset, targeted native runtime/push tests. Task 1 owns the maintenance section and `server/app.mjs`; coordinate any required hook there.

- [ ] Add failing tests for offer tap routing, stale suppression, dedupe and payload TTL/priority/channel.
- [ ] Bundle a short generated WAV and configure `partner-offers-v1` using SDK 57 docs; use ordinary OS notifications without calling privileges.
- [ ] Suppress stale outbox offers/retries by checking round/recipient/expiry/booking and current settings; no lock-screen customer data.
- [ ] Avoid duplicate local/remote foreground sound and respect the in-app alert preference.
- [ ] Integrate a prompt, bounded outbox drain after committed offer/payment mutations; retain background recovery.

## Task 5: Integration, review and review release

- [ ] Review each contribution against the spec; integrate contracts and resolve any failures at their source.
- [ ] Run Node tests, lint, typecheck, web/native exports, relevant browser suites, Firestore/index/concurrency checks and secret scan.
- [ ] Obtain independent review focused on booking races, authorization, privacy and financial correctness; fix reportable regressions.
- [ ] Update the client checklist with exact flows and remaining externally blocked production gates.
- [ ] Commit tested changes, update the attached draft PR, deploy tested backend/site to the already-authorized free review services and request a new free Android review APK if credentials remain available.
- [ ] Verify deployed readiness and built artifact launch. Do not label untested physical notifications, refunds, iOS signing or production operations as passed.

## Execution ledger

- Baseline: clean `5dc5781`, 191 Node tests pass. Work continues on the existing dedicated review branch to keep the attached draft PR and its current unmerged release history together.
- Ruling: use the user's detailed operating request and delegated implementation authority as the specification; no redundant design-approval pause.
- Ruling: parallel contributions have disjoint file/section ownership. Integration and final review remain sequential.


### Integration verification — 2 November 2026

- Implemented Tasks 1–4 and exercised the new office/partner story in `tests/browser-office.cjs`, now part of CI.
- Fresh `npm run check`: TypeScript and lint pass; 253 Node tests pass.
- Existing core, feature, launch and marketplace browser suites pass; new office browser flow passes.
- All-platform Expo export succeeds (web, Android and iOS JavaScript bundles).
- Firestore emulator: five tests pass, including simultaneous partner claims and overlapping-job exclusion. Stress harness: 1,094 requests, zero server errors, passed.
- Independent review found three actionable integration bugs: late capture replacing foreign locks; internal self-service bypass of office dispatch; accountless workers being selected by automatic assignment. All reproduced with failing tests, then fixed with passing regression tests.
- Additional regressions fixed: independent laundry custody revision, long real partner offer IDs, reassignment after arrival. Worker search remains visible while filtering; internal-call action is limited to internal workers.
- Compatible dependency updates: multer 2.5.0, root Zod 4.6.7, and transitive patch updates. Latest audit: 44 affected entries (2 high, 41 moderate, 1 low); both high entries are nested Expo CLI/Zod tooling. No forced SDK downgrade or incompatible Zod major override was applied. Findings remain a release review item.
- Hosted Firebase authentication/Firestore/dashboard reads verified without writes. Deployment/index verification and signed APK release are tracked separately below; do not infer success from local checks.
