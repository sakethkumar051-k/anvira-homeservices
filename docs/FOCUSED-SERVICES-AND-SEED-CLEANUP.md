# Six core services and seed cleanup

The public website and local sample catalog focus on home cleaning, car cleaning, AC repair, RO filter service, plumbing and electrician services. Home cleaning contains kitchen, bathroom, sofa and whole-home packages. RO includes routine service, compatible filter-fitting labour and installation. Parts, filter cartridges, membranes and major repair work require an approved quote where the package excludes them.

`server/lib/sample-catalog.mjs` is a local demonstration and draft template catalog. Its INR amounts remain fictional; they are not approved launch prices. `src/lib/marketing.ts` supplies the six public enquiry categories without advertising these sample amounts. Existing owner-created services and company policies are not automatically replaced on Firebase.

## Cleanup tool

Preview a local cleanup without changing data:

```sh
node scripts/clear-seeded-data.mjs --sqlite=server/review-demo.sqlite
node scripts/clear-seeded-data.mjs --sqlite=server/anvira.sqlite
```

Apply only after reviewing the counts. A new absolute encrypted backup path is mandatory; the tool creates and verifies the snapshot before any deletion. `BACKUP_ENCRYPTION_KEY` must already be configured. Keep archives private and outside exported website directories.

```sh
node scripts/clear-seeded-data.mjs --sqlite=server/review-demo.sqlite --apply --backup=/absolute/private/pre-cleanup.enc
```

Cloud inspection requires the exact configured project and working Firebase credentials:

```sh
node scripts/clear-seeded-data.mjs --project=anvira-services
```

The default is a dry run. Cloud application additionally requires `--apply`, `--backup=/absolute/private/new-archive.enc`, test payments and disabled payouts. Never use the older `reset-client-test-data.mjs` for this purpose: it replaces broad business data and creates new fictional history.

The targeted tool preserves all settings, catalog records, Owner and Customer Care profiles, and all Firebase Auth accounts. In cloud mode, a name or `review-` ID alone never proves a record is seeded. Only explicit `sample: true`, `seededHistory: true` or a stored `seedBatch`, or direct links to a proven seeded booking, qualify. `reviewOnly: true` alone is a test-payment environment marker and never establishes seed provenance. Records with non-demo provider payment identifiers are preserved. A seed profile linked to surviving booking, quote, ticket or financial history is retained.

The two named local demo databases additionally recognize the shipped legacy seed booking keys and known fictional profile names. Manually created `booking-*` history remains. Mixed local demo wallets are recalculated from retained ledger records only when no surviving payout requires separate reconciliation. Unknown collections or archive coverage gaps prevent application. The database must still match the verified backup when the transaction commits.

## Local cleanup performed on 16 November 2026

The review database had 1,200 records. Cleanup removed 1,026 proven seed records, including 33 generated bookings, two simulated payouts and their related records. Three manually created demo bookings and their history were preserved. One mixed wallet was reconciled to its retained ledger. Owner, Customer Care and company settings were preserved.

The default local database had 13 records and no bookings. Five known fictional customer/professional records were removed; staff and settings were retained. Both local catalogs were then refreshed to the six core sample services after checking them against the verified archives. The legacy five-service catalog was recognized by its exact original sample copy and structure.

Private encrypted archives are in `server/backups/pre-focus-cleanup-20261116-review.enc` and `server/backups/pre-focus-cleanup-20261116-default.enc`. These local archives use project names `local-demo:review-demo.sqlite` and `local-demo:anvira.sqlite`; they cannot be restored into a Firebase project using the normal backup CLI.

The local cleanup did not change cloud data or Firebase Auth accounts. The separately authorized cloud cleanup and verification are recorded below; local source changes do not establish what is deployed.

Local startup now uses `SEED_DEMO_PEOPLE=false` in `.env` and the demo runner, so it does not recreate fictional customers or workers. The catalog, staff and settings still initialize. An explicit demo sign-in creates only the selected role's user record when needed. `npm run demo` no longer creates historical bookings; `SEED_REVIEW_HISTORY=true npm run demo` explicitly opts back into fictional QA history.

## Read-only Firebase audit on 17 November 2026

The latest dry run scanned 328 cloud records and selected 244 proven seed records for removal, while preserving 84 records. It preserved both manually created test bookings, five user profiles (including the seeded account linked to retained booking history), all eleven cloud catalog records, both settings documents, and all Firebase Auth accounts. The reviewed cleanup was subsequently applied with exact expected counts, a fresh encrypted backup and a concurrent-data guard. Post-cleanup verification found 84 remaining documents, no remaining cleanup candidates, both runtime bookings, unchanged staff/company settings and all eleven catalog records unchanged. No Firebase Auth account was modified.

All eleven cloud services are currently active, use instant booking, have `sampleReviewed: true` and remain `reviewOnly: true`. The AC and Painting records have `sample: false`; those reviewed records require a deliberate migration decision. The cloud catalog has no RO service. Source and local catalog updates do not update Firebase automatically.

| Cloud service ID | Category | Stored base price | Sample |
| --- | --- | ---: | --- |
| review-ac | AC | ₹599 | false |
| review-appliance | Appliances | ₹349 | true |
| review-bathroom | Bathroom | ₹699 | true |
| review-car-cleaning | Car care | ₹499 | true |
| review-cleaning | Cleaning | ₹1,499 | true |
| review-electrical | Electrical | ₹299 | true |
| review-handyman | Handyman | ₹599 | true |
| review-laundry | Laundry | ₹299 | true |
| review-painting | Painting | ₹199 | false |
| review-plumbing | Plumbing | ₹299 | true |
| review-sofa | Sofa care | ₹899 | true |

These are observed stored base amounts, not an approval of launch prices or a substitute for package/option pricing. A six-category cloud migration can retain stable core service IDs, preserve reviewed scope, use quote-only booking until prices are approved, add RO as quote-only, and archive the extra categories. It must not silently overwrite the two reviewed entries or discard retained booking history.

The verified cloud archive is `server/backups/pre-focus-cloud-20261117.enc` (328 documents). All 244 removed records were absent in the independent post-cleanup check. All 40 deleted bookings carried `sample: true`, `seededHistory: true` and `seedBatch: review-20261103`, with no provider order/payment references. Of the 244 candidate records, 233 carried that exact batch; eleven additional records were proven sample/booking dependants. The two retained bookings had no sample/history/batch marker; one retains provider references. `reviewOnly` alone did not qualify either for deletion.

The catalog migration was drafted offline in `scripts/draft-focused-catalog.mjs`, reviewed, and applied through the separate guarded `scripts/apply-focused-catalog.mjs`. Its details and verification are recorded in `docs/CLOUD-CATALOG-MIGRATION-DRAFT.md`. A second verified encrypted snapshot, `server/backups/pre-focus-catalog-20261117.enc`, preserves the pre-migration state. The cloud now has twelve stored catalog records and exactly six active services; the hosted public API returned HTTP 200 with those six. The draft-generation tool itself still has no database write path and refuses `--apply`.
