# ANVIRA feature audit — 6 October 2026

This audit covers the source in `/Users/sakethkumar/Downloads/anvira-app`. The three app experiences share one Expo application and API; Owner and Customer Care are separate permission levels within operations. The improved task brief is in `IMPROVED-REQUEST.md`.

## Improvements implemented

- Customer Home shows the next active service with its appointment, status, and a direct booking link. Featured cards use the selected service’s actual price.
- Booking details show recorded progress timestamps, a loading state with retry after failure, receipt discounts, booking-linked support, and a repeat-service shortcut after completion/cancellation. Rescheduling/reassignment clears the previous professional’s acceptance timestamp.
- Professional active jobs appear in appointment order; the empty state explains availability in a live app rather than referring to demo bookings.
- Customers and professionals can choose a support topic, attach their booking, send follow-ups, and reopen a resolved request. The server checks both booking access and request ownership.
- Owner/Care can reply under the public ANVIRA Support identity and record a resolution summary. Repeated resolution does not duplicate the summary or notification.
- A review of three stars or below opens one high-priority, booking-linked quality follow-up and notifies the customer. Reviews remain restricted to completed, unreviewed bookings.
- Owner/Care can view all requests, open requests, or quality follow-ups. Filters run on the server across the entire collection and reset pagination so older unresolved issues remain discoverable.
- Record lists, summaries, booking conversations, and payment listeners stop background work when their route loses focus. This avoids repeated API requests from retained navigation screens and refreshes records when the user returns.
- Shared buttons expose disabled/busy state for accessibility. Core new interactions have Telugu translations.
- Firebase sign-in supports Google, email/password, registration and password reset. Clear errors cover pop-up cancellation/blocking, duplicate accounts, invalid credentials and connectivity. No phone verification flow remains.
- Exports load and pass the chosen Firebase/demo authentication mode before starting Expo workers and clear stale transforms. This keeps the two preview builds consistent when switching environments.
- A dedicated demo launcher uses port 4001, `dist-demo/`, and `server/review-demo.sqlite`. `?sample=customer` signs into a sample customer only in the demo build. Live authentication retains its Firebase-only sign-in path. Browser tests explicitly use a separate demo API on port 4199.

## Existing features examined

| Experience   | Features                                                                                                                                                                                                                                                                                                     | Verification boundary                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Customer     | English/Telugu navigation, catalog/search, inclusions/exclusions, add-ons, Indian service slots, PIN coverage, saved addresses, quote/discount, booking/payment state, assigned professional, private booking conversation, reschedule/cancel, refund receipt, one review, support, profile/account deletion | API regressions and local browser journeys; real money and signed-device Google sign-in require external validation                                          |
| Professional | Assigned jobs, acceptance/decline, reassignment, start/completion checklist, availability, skills/service areas, schedules, onboarding/document controls, personal/work workspace switching, earnings/commission snapshots, support                                                                          | Browser workflows and API permission/state tests; physical-device uploads/push and provider payouts require staging verification    |
| Owner/Care   | Booking oversight, assignments, refunds, support, catalog/prices, professional approval, promotions, staff roles, settings/policies, full-history aggregates, date-range analytics/CSV, audit, reconciliation/payout controls                                                                                | Browser navigation/forms and API security/financial tests with mocked providers; Care is barred from Owner financial/admin controls |
| Backend      | Identity/role checks, session cookie/CSRF, request limits, slot capacity, idempotent booking/payment/refund/payout handling, reservation/assignment expiry, protected documents, deletion/anonymization, message expiry, pagination                                                                          | Automated local API tests; Firestore connectivity/index reads separately verified without sample customer data writes               |

## Local review

Run `./RUN-DEMO.command` or `npm run demo` with Node 24. The first run prepares a sample upcoming cleaning booking and saved home address; later runs preserve your review data. Open `http://localhost:4001/?sample=customer` to enter as the sample customer. Demo services cover Shadnagar PIN 509216. Payments are simulated and bookings stay in the local sample database. Sign out from Profile to explore Professional, Owner, or Customer Care. A reload clears the memory-only demo session; the sample URL signs in again.

The Firebase app remains at port 4000 with its own live environment and Owner account. The sample app does not add services, customers, bookings, or tickets to Firestore.

## Authentication update

Google and Email/Password are enabled on Firebase Spark. Phone authentication remains disabled, and all phone verification controls/code have been removed. Phone numbers can be saved as unverified contact details. See [AUTH-UPDATE.md](AUTH-UPDATE.md) for verified results and native build requirements.

## Launch gaps and limits

- Firebase Authentication/Firestore and the Owner email/password account are connected. Live company settings, approved policies, service catalog, approved professionals, hosted API/website remain unfinished.
- Storage, Functions/Hosting deployment, Razorpay test/live credentials and approval, optional RazorpayX configuration, and EAS signing/project setup still need external account work. Live payments/refunds/payouts, push delivery, document storage, and Apple/Android device behavior are not declared passed by local simulations.
- Native export checks verify bundling, not installed-device operation. Firestore emulator rules tests require Java, which is not installed here; deny-all client rules are unchanged.
- The current npm dependency report is `evidence/dependency-audit-auth.json`. It contains upstream/tooling advisories, including some without a patched version. Automatic suggested major downgrades conflict with the current Expo SDK. Existing gRPC and URI-decoder mitigations remain in place. This is not a clean security audit or a production launch approval.
- The initial app state contains the latest 200 bookings. Customer and operations booking lists can load earlier bookings; the professional job history also supports paginated history. Operations records have server pagination and summaries aggregate full history. High-volume marketplace search/ranking, dispute/chargeback automation, partial refunds, tax invoicing, payroll, phone calling, attachments, real-time sockets, and formal support response-time commitments need separate business requirements.
- Fluent Telugu review, screen-reader/physical-device testing, real service descriptions/prices, approved branding, and real customer/professional pilot feedback remain release work. No claim of a “perfect” or entirely production-verified system is made.

## Service customization and profile update

The latest service builder, support-send, profile-photo, arrival/checklist and job-history improvements are detailed in [SERVICE-EXPERIENCE-UPDATE.md](SERVICE-EXPERIENCE-UPDATE.md). The current live Firestore read check returns quota exhaustion; Firebase dashboard availability from the earlier check below is historical, not a current success.

## Earlier verification results

Lint/typechecking and 46 API tests passed. Twenty-one browser journeys passed with no runtime errors or HTTP 429/5xx failures. Expo Doctor passed 21/21 checks; web, iOS and Android bundle exports succeeded. Firebase Authentication/Firestore/dashboard reads passed and all 30 indexes were READY. The review seed was run twice and retained exactly one confirmed sample booking.

Final command results and browser scenarios are recorded in `evidence/feature-check-results.json` and `evidence/ui-results.json`. Screenshots in `evidence/` document the sample UI. Only the final successful runs are reported as passed.
