# Six-service marketplace implementation plan

> **For agentic workers:** Use parallel independent implementation with a final integrated review.

**Goal:** Make ANVIRA a photographic six-service mobile marketplace with real phone OTP authentication.
**Architecture:** Existing Expo Router customer and staff surfaces, shared service catalogue, Express/Firebase identity verification; web storefront uses DOM for responsive layouts and native screens use bundled photographs.
**Tech Stack:** Expo 58, React Native 0.88, React 19, Firebase Auth/Admin, Express, TypeScript.
**Spec:** docs/superpowers/specs/2026-11-16-six-service-marketplace-design.md

## Constraints and review focus
- Keep real prices and scope from published records; marketing topics cannot silently become bookable products.
- Never label edited contact numbers verified; derive verified numbers from Firebase tokens.
- Preserve checkout selection across sign-in and isolate approved staff access.
- Backup and delete only proven seeded records; no automatic reseeding of review history.
- All six categories must work with zero catalogue rows, slow API, broken image, long labels and narrow screens.

## Tasks
- [x] Inspect signed-in UC home, cleaning, AC, RO, plumbing and electrical flows and supplementary car-cleaning references; record observed patterns.
- [x] Restore real phone OTP adapters, input/cooldown/error states, safe return route, backend verified phone persistence, provider/CSP config and meaningful tests. Auth agent owns auth modules and narrow auth server/UI sections.
- [x] Focus demo catalog and authored marketing content on six categories with packages; add targeted seed cleanup, dry-run + backup, provenance tests. Catalog agent owns seed/data modules.
- [x] Replace native customer Home, ServiceCatalog and service detail art with relevant photos, category navigation, scope and package cards. Native agent owns those components.
- [x] Build responsive public web marketplace, category search and browse, connected service details, truthful campaign banners, policy/contact links; enable customer web routes and preserve staff entry. Root owns web and routing/deployment config.
- [x] Run lint/typecheck/full tests, web export and real browser flow checks; review changes and fix integration defects. Record what needs live credentials/provider setup.

## Outcome

Implemented and verified locally; cloud catalog/data cleanup and India-only Firebase Phone enablement applied. Publication, real SMS delivery and signed-device acceptance remain separate release gates documented in `docs/SIX-SERVICE-REVIEW.md`.
