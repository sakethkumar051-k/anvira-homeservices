# Standard service booking

User direction: replace the quote-dominated experience with understandable normal service choices, editable starting prices based on Urban Company references, and relevant optional extras. Execution and routine product decisions are delegated in the existing session.

Approach: use the existing package/price/availability contracts. Publish six normal service menus across the existing six categories plus the existing monthly Car Care plan. Standard jobs book directly; diagnosis visits clearly exclude repair/parts. Large bespoke work and monthly plan approval keep the team request path. No new dependency, recurring-billing claim, fabricated rating or automatic extras.

- [x] Research published Hyderabad price references and document which prices are adopted, derived or internal ANVIRA drafts.
- [x] Add a standard catalogue module, schema/selection tests for every package and compatible extra, and a guarded test-environment migration with encrypted backup, exact before-state comparison, idempotence and preservation of existing bookings/staff/unrelated services.
- [x] Improve mobile package choice: simple task names, amount and duration visible together, clear includes/extra-cost disclosures, direct per-option booking, package-specific extras, secondary help for customers unsure what to choose.
- [x] Preserve existing admin editing; add an understandable standard service/price overview to the existing editor if needed. Complete Telugu strings for new choices and scope.
- [x] Apply the catalogue to the connected ANVIRA test project after local validation. Verify the hosted catalog and real availability for each standard option; never create a real paid booking as a test.
- [x] Browser-test every standard service, compatible extras, no preselected extras, checkout and admin price edits, narrow English/Telugu layouts; run lint/typecheck/unit tests and native exports. Review the patch and reload the existing Expo Go server.

Application: 6 service records (5 updated, 1 new) and 2 existing accountless test-worker skill lists changed under the exact reviewed fingerprint. Encrypted backup was verified before writing. Hosted catalog returns 6 instant menus/34 choices plus the untouched monthly plan. Read-only cloud availability checked all 34 with no unavailable options.

Review: fixed an explicit Book selection being overridden by an edited saved draft. Each new Book now has its own entry identity and clears extras; reloading that checkout still restores explicit edits. Required admin-defined choices remain visible at checkout and are counted in the menu starting price.

Verification: 364 unit tests, lint/typecheck; browser checks for all 34 choices, 6 demo paid bookings, compatible unselected extras, explicit fresh-selection vs reload, admin price editing with earlier booking snapshot intact, advanced required choices and 320px Telugu menus. Existing cart and whole-app browser regressions plus native exports recorded in docs/STANDARD-SERVICE-PRICING.md.
