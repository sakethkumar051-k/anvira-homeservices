# Six-service cloud catalog migration — reviewed and applied

The seed-history cleanup and the separately reviewed catalog migration were applied on 17 November 2026. The catalog now contains twelve stored records and exactly six active services. The actual hosted `/api/catalog` endpoint returned HTTP 200 with those six services after application.

The private concrete artifact is `server/backups/focused-catalog-draft-20261117.json`. It contains every original and proposed service object plus SHA-256 guards for the originals. It was generated offline from the verified cloud archive by `scripts/draft-focused-catalog.mjs`. That script has no Firebase import or database write path and rejects `--apply`.

## Proposed active catalog

| Stable service ID | Customer category | Booking behavior |
| --- | --- | --- |
| review-cleaning | Home cleaning | Tailored quote before payment |
| review-car-cleaning | Car cleaning | Tailored quote before payment |
| review-ac | AC (reviewed existing record) | Existing ₹599 base price and booking behavior unchanged |
| review-ro | RO filter | Tailored quote before payment |
| review-plumbing | Plumbing | Tailored quote before payment |
| review-electrical | Electrician | Tailored quote before payment |

The reviewed AC record remains byte-for-byte unchanged, including its name, description, base price, packages, exclusions, warranty and booking mode. The draft aborts if the expected reviewed ₹599 record is not supplied. `sample: false` and `sampleReviewed: true` record a reviewed state; those flags alone do not independently prove who approved it or that every original sample price is commercially approved. This proposal deliberately preserves that existing decision.

The four other existing focus records become quote-only. Their stable IDs and internal numerical configuration remain for reversibility, while customer copy asks for requirements and explains that the office confirms scope, materials, duration and price before payment. The draft does not invent new standard launch prices. Customer pricing helpers and standard checkout must continue respecting `bookingMode: quote`.

Home cleaning incorporates the existing bathroom and sofa scopes as unpriced-to-the-customer quote options inside the retained cleaning record. The original standalone records remain archived. New RO has maintenance, compatible-filter and installation enquiry guidance. The existing schema requires a positive numeric base field, so the new quote-only RO record contains an internal ₹1 validation placeholder and no priced packages or add-ons; that field must never be advertised or charged as a service price. A future schema allowing absent prices for quote-only services can remove this internal placeholder.

## Records retained inactive

The draft sets `active: false` on `review-appliance`, `review-bathroom`, `review-handyman`, `review-laundry`, `review-painting` and `review-sofa`. It never deletes these records. Reviewed Painting changes only `active`; its scope, price and review metadata stay intact. An unexpected custom/non-review extra service causes the draft to abort for manual review.

This yields twelve stored records and exactly six active services. Photo selection remains in the app's bundled presentation mapping; no external photo URL or database image migration is necessary.

## Application and reversal

`scripts/apply-focused-catalog.mjs` is the separate applicator. It defaults to a read-only preview and requires the exact project, reviewed absolute draft path and a new absolute encrypted backup path before `--apply`. It compares every original against the draft's `beforeHash` and verifies a whole-recordset hash again inside the transaction. The eleven bounded service operations were applied atomically only after those checks passed. The verified pre-migration snapshot is `server/backups/pre-focus-catalog-20261117.enc`. Rollback restores each `before` object and removes only the newly created `review-ro` if it still matches the applied draft and has acquired no real references. A later user edit or new booking requires manual reconciliation instead of blind rollback.

Draft tests verify untouched reviewed AC, inactive-but-preserved reviewed Painting, six active focus IDs, quote-only behavior for unapproved focus prices, reversible originals/hashes, and rejection of unexpected real categories.


Post-application checks confirmed: reviewed AC unchanged in full; reviewed Painting changed only to inactive; both runtime bookings unchanged; staff/company policy unchanged; no Auth mutations; all six public services pass the service schema; all five quote-only services hide numerical catalog prices and reject standard-price checkout with `QUOTE_REQUIRED`. RO's Telugu name has no SAMPLE prefix. The preserved reviewed AC record still carries its original `SAMPLE ·` name prefix; its stored name was intentionally preserved with the rest of that record.

The snapshot before catalog migration contained 84 records; after adding RO the database contained 85. Neither a website nor backend deployment was run as part of this database migration. The existing hosted API picked up the catalog changes directly from Firestore.
