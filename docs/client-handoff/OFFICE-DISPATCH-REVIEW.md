# ANVIRA office workflow — client test checklist

Updated 2 November 2026. This is a test release. Razorpay stays in test mode.

## Set up the business on the website, in this order

1. Sign in at https://anviraservices.com/staff as **Admin / Owner**.
2. Open **Services**. Add each actual service: category, description, included work, exclusions and a clear booking unit. Choose published pricing or a tailored quote; configure packages, required priced choices, questions and extras. Require a package whenever the base scope must not be sold. Save as draft while reviewing. Publish only approved services. See [Owner setup and service configuration](ADMIN-AND-SERVICE-SETUP.md).
3. Open **Roles & settings**. Confirm coverage PIN codes, support contact, published terms/privacy links, cancellation policy and commission settings. The agreed partner commission preset applies per booking: under ₹1,000 → 10%; ₹1,000–9,999 → 15%; ₹10,000–19,999 → 20%; ₹20,000+ → 25%.
4. Open **Internal workers**. Add each salaried worker's name, services, PIN codes, working days/start times and leave dates. These records create **no login account**. Optional phone numbers are staff-only.
5. Return to **Roles & settings → Office dispatch**. Enable office dispatch and save. Existing bookings keep their original workflow.
6. Keep **External partner fallback** off until the office is ready. When enabled, only approved, available external partners matching the service, PIN and schedule receive offers if internal capacity is exhausted. A service can disallow external fulfilment. The first eligible acceptance wins; expired/withdrawn offers cannot be accepted.
7. Create Customer Associate staff access through the Owner staff controls. These staff handle orders, internal availability and customer support; business configuration stays on the Owner website.

## Test one internal job

- Customer installs the new review APK, signs in, chooses a published service/address/slot and pays through **Razorpay Test Mode**.
- Customer sees the office arranging the visit.
- Customer Associate signs in through **Staff** on mobile or the website and opens **Orders & dispatch**.
- Assign an internal worker, mark the team dispatched, record arrival, start service, complete every checklist item and record completion.
- Customer checks status, receipt, completion notes and support/review options.
- Confirm the internal worker has no app/login requirement and receives no partner wallet credit. Salary is handled by the company.
- For laundry, test custody stages and an actual return separately. A recorded return requests a refund; it does not mean the payment provider has refunded money.

## Test external fallback

- Make the relevant internal staff unavailable and enable external fallback for the company and service.
- Use two approved external partner accounts on separate phones.
- Customer creates and pays for another matching booking.
- Partners open Jobs, inspect service/PIN/time, countdown and gross/commission/net preview. Full customer address is withheld before assignment.
- Both try to accept: exactly one wins. The winner then sees the booking details and performs the job. Check wallet amounts after completion.
- Test decline, expiration, withdrawn permission, offline/retry and a full internal roster. The office must see orders needing attention.
- Notification sound is an ordinary OS notification. Test actual phones in foreground/background; permission, device settings, FCM/APNs credentials, network and free-host cold starts affect delivery. No guaranteed incoming-call alarm is promised.

## Still required before real launch

- Client approval of actual services, pricing, coverage, staffing, legal address, GST/invoice treatment and published policies. Sample services/policies are for review only.
- Razorpay activation/KYC and live credentials; provider-verified refund and webhook reconciliation. Do not collect real money while the review environment uses test credentials.
- Partner verification/document-storage and payout operating process. Private uploads and automated payouts remain gated until their prerequisites are met.
- Physical Android acceptance, notification delivery tests, and signed iOS/TestFlight testing. A passing browser test or JavaScript export is not a physical-device test.
- Client-owned Apple Developer and Google Play organisation enrolment/verification, store assets, review accounts, privacy disclosures and submission.
- Hosting appropriate for commercial use, backup/restore and monitoring. The current no-payment-method free setup is a review environment: Render sleeps and cannot guarantee immediate dispatch. Vercel Hobby's commercial-use restrictions remain a launch decision; this work does not select or purchase a paid plan.

## Verification record

The local browser story covers roster validation, Owner settings, customer simulated payment, mobile Customer Associate assignment/dispatch/arrival/start/checklist completion, and private partner offers through acceptance. Separate backend tests cover stale revisions, withdrawal/expiry, competing claims, late-payment reservation safety, in-house zero earnings, and legacy compatibility. Firestore tests verify first-accept races using the actual datastore adapter. These checks do not certify real Razorpay refunds, physical push delivery or store approval.
