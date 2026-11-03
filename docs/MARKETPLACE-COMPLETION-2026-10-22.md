# ANVIRA marketplace completion — 22 October 2026

## Implemented in this working branch

- Tailored work requests for an existing published service and covered address.
- Owner-priced proposals with line items, scope, duration, validity and revision checks. Customer Care can review requests; only Owner sets prices.
- Customer acceptance/decline, Owner withdrawal, and accepted-quote checkout using the existing capacity reservation, payment, cancellation, refund and partner earnings flow. The approved price is copied into the booking; later quote edits cannot change its total. One quote funds one booking. An expired/cancelled reservation requires a new quote request; support must not manually reuse a captured payment.
- Configurable laundry fulfillment on service editor. Existing bookings retain their original workflow. Collection → received → processing → ready → out for delivery → delivered requires sequential, authorized updates and notes. Delivery must be recorded before completion/partner credit. Staff can record physical return without service, cancel the job and request an Owner-reviewed refund; no partner completion credit is created. Lost/damaged item compensation still needs approved policy and a support case. These are operational records, not GPS or customer signatures.
- Home care passport: saved services, private assets with manually entered installation/warranty dates, completed history grouped by home, and recurring reminders with pause/resume/edit/delete. Reminders never reserve, charge or create bookings. Warranty dates are customer records, not a new ANVIRA warranty promise.
- Account deletion covers quotes and private home-care records. Database backups include all new collections. Worker invokes reminders before push delivery.
- Readable staff login errors for backend HTML/502 responses; retry works after backend recovery.

## Sequential completion checklist

1. **Client business decisions:** approve service catalog, complete prices including tax, coverage PIN codes, visit durations, available slots, cancellation/refund rules, laundry pickup/delivery turnaround and responsibility for lost/damaged items, warranty/revisit terms, commission/payout rules and invoice requirements. Yes: clear business needs and pricing are launch prerequisites.
2. **Populate approved data:** Owner configures services and qualified professionals, reviews sample entries, prices custom work, publishes actual policies and support contacts. Do not activate laundry without capacity and terms.
3. **Deploy reviewed code and indexes:** deploy this branch through existing project hosting. Deploy `firestore.indexes.json` and wait for indexes to finish building. No paid plans or billing enrollment are authorized. Keep a backup and rollback version.
4. **Verify free hosting limits:** sleeping hosting can delay login and reminders; reminders run when the scheduled worker runs. Confirm authenticated worker scheduling, quotas, database persistence, backups, private document storage and recovery. A free tier does not establish an availability guarantee. Private document upload must remain gated if durable private storage is unavailable.
5. **Payment validation:** finish the client's Razorpay onboarding/verification. Verify an actual order, capture/webhook replay and refund using approved credentials and policies. Never expose keys in chat or the app bundle. Payouts remain disabled until separately configured and tested.
6. **Device acceptance:** build signed Android/iOS candidates and test on actual devices: sign-in/OTP/social login, notification cold start, permissions, weak network/retry, booking/payment/cancel/refund, quotes, laundry, home care, support and deletion. JavaScript exports and browser tests do not replace these checks.
7. **Store enrollment and submissions:** client obtains D-U-N-S if needed, completes Apple/Google organisation verification and fees, provides legal/support/policy details, screenshots, app descriptions and reviewer access. Finish privacy/data-safety declarations against the actual shipped behavior. Use the client checklist under `docs/client-handoff/`.
8. **Launch sign-off:** verify live service data, operational staffing, support response ownership, monitoring and a rollback drill. Submit only the tested builds. Store approval timing is outside development control.

## Scope still requiring separate implementation or approval

This change does not add prepaid memberships, automatic recurring charges, multi-provider quote bidding, live GPS tracking, an external courier integration, automated GST tax invoices, or a legally binding service guarantee. These are not implied by care reminders or laundry progress notes. They require business rules and, where relevant, external accounts and additional end-to-end validation.

## Verification

Validated with Node 24 on 23 October: typecheck and lint pass; 188 Node tests pass. Android/iOS/web JavaScript exports pass. Browser checks pass for the quote request → Owner proposal → acceptance → approved-price booking journey; home-care favorites/assets/reminder creation and pause; and eight existing service customization, payment, professional handover and mobile profile scenarios. Local source changes are not automatically deployed. No claim is made that all possible defects are eliminated or that store submission is complete.

## Client review status — 23 October

- Signed Android APK finished on EAS (build c1bef7ea-0927-4f61-9bad-2d93978853ee). Physical Android acceptance and iOS signing remain pending.
- Confirmed public support phone: +91 79893 65699.
- Owner-editable booking commission slabs and in-house salary treatment are implemented. Test earnings are isolated in review wallets/ledger and cannot fund live payouts.
- Actual Razorpay test checkout/capture succeeded against disposable local data. Actual sandbox refund returned HTTP 400; no completed refund or hosted webhook delivery is claimed.
- Core, feature and launch browser suites pass with no reported runtime errors. Source secret scan has no findings.
- Hosted review release verified: Render deployment dep-dbdfdh6i0phs739kaa20 and Vercel deployment 1215tqiyZpNEV1D14QTovw4ygPZL serve commit 6c398ef. Public API/ready/catalog return 200, catalog contains 11 labelled SAMPLE services, two fictional professional profiles were created, all 34 Firestore indexes are READY, review policies and agreed commission slabs are saved. Encrypted backup validated before sample preparation. No Firebase Auth accounts or real payouts were created.
- Razorpay dashboard confirms the test webhook is enabled with payment captured/failed and refund created/processed/failed events. Delivery is not yet proven. Dashboard refund also fails with “Subgraph errors redacted”; provider support must resolve this before launch.
- Dependency audit reports 28 affected package entries (21 high, 7 moderate), including build-tool transitive dependencies. These require reachability/upgrade review before production; automated downgrade suggestions have not been blindly applied.
- CI exposed a browser-harness issue: full Playwright Chromium was receiving serverless single-process flags. The harness now reserves those flags for the serverless browser fallback; the subsequent CI run passed every browser suite. Its stress step exposed exhausted Firestore transaction retries returning 500; these now return a recoverable 409 CONCURRENT_UPDATE. A regression covers both numeric and named ABORTED errors without writing a booking. Local emulator validation passes all four datastore checks and 1,094 stress requests with zero server errors; one contested slot creates one booking and rejects 29 other requests. This does not certify production capacity.

- Vercel API origin and release channel now cover Production and Preview. Rebuilt Preview deployment EGyCwAXv58XDzXA5QrcnqRraM4m7 is READY.
