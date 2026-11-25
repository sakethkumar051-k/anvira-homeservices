# Clear validation and automatic dispatch — 25 November 2026

## How to use it

In Admin → Roles & settings → Office dispatch, choose **Use recommended automatic flow**, then **Save dispatch settings**. Paid bookings then use an eligible ANVIRA worker first. When none can cover the exact service, PIN and visit time, approved outside professionals receive offers in groups of five. The first eligible acceptance confirms the booking. Automatic offers use at most two rounds with a three-minute overall deadline; manual overrides remain available.

To stop ANVIRA handling only for a service/area, use **ANVIRA team availability by service**, select the relevant service/PIN pause, then **Save team availability rules**. This does not disable customer booking when eligible partners can cover it. It does not move already assigned visits. Closing the admin site never changes availability.

Each active staff booking has **Dispatch progress** and **Why this assignment?**. These show the reason, timeline, offer responses and push-provider status. Provider receipts do not mean a professional read the alert. Failed/no-device delivery does not extend an offer's deadline.

Admin → Automations → **Dispatch simulator** runs six sample scenarios in a new memory database: ANVIRA available, outside acceptance, no capacity, simultaneous acceptance, no acceptance, and notification failure. It cannot access the live store, send real pushes or move money. The notification-failure scenario exercises the real retry implementation through an isolated failing transport.

## Customer forms

Monthly Car Care now allows Submit to explain missing details. Required answers, description, full address and PIN coverage have field errors and a first-error focus. Successful requests state that no payment was taken. Inputs survive failed requests. Shared input error/help support and reasons beside blocked actions cover quotation/proposal, checkout, service completion, professional onboarding, bank verification, support and admin editors. English and Telugu copy are included.

## Dispatch implementation

Existing installations remain manual by default. The approved recommended mode was enabled on the ANVIRA test backend during this rollout. Company updates preserve other settings; unchanged dispatch permissions do not invalidate offers. Transactions and shared locks enforce the first valid acceptance and prevent overlapping assignment. Matching, checkout and availability paginate beyond 200 approved profiles. The admin diagnostic list explicitly identifies its display limit.

Automatic rounds use a dedicated dispatchDueAt queue so old manual/terminal records cannot block it. The fast clock checks every five seconds only while a deadline is active; payment events wake it and a minute watchdog recovers idle/restarted instances. Notification network requests have an independent guard and cannot hold up dispatch. Queued wakes and overdue batches remain active until processed. These clocks require a running backend; sleeping free hosting cannot guarantee a strict elapsed-time response.

No automatic cancellation/refund policy was added. An unfulfilled paid visit escalates to the office for customer contact, roster review or rescheduling.

## Verification and release

Evidence and browser results: evidence/automatic-dispatch/. Automated verification covers field errors and valid requests, automatic internal assignment, service/PIN pause, outside offer privacy and acceptance, all simulator scenarios, races, expired rounds, roster pagination, push retries, slow push, lost wakes and queue starvation. Release/deployment and device-test outcomes are recorded below after they are observed.

### Hosted rollout observed on 25 November 2026

- Product snapshot: `6cab6204424943b7ec9582fffec9368c8c9b6777`, branch `codex/marketplace-completion`. Later commits only update regression checks and handover evidence.
- Render Free deployment `dep-dc3etu49v7es73bmjmdg` is live at https://anvira-api-staging.onrender.com. Health confirms Firebase, Razorpay **test** mode and payouts disabled. No paid hosting upgrade was made.
- Required Firestore indexes are READY. Hosted readiness and the indexed awaiting-assignment queue return 200. The dedicated dispatch heartbeat is healthy.
- All six isolated simulations ran on the hosted API. Internal assignment succeeded; outside acceptance and race each produced one winner; no capacity and timeout escalated to office attention; simulated push failure queued retries. Real notifications sent: zero.
- Approved routing was enabled through the owner-only policy API and read back from Firestore: office-first, automatic internal assignment, outside fallback enabled, 90-second offer windows. Unrelated settings and existing assigned visits were preserved.
- Android preview build `7ba61176-fc8b-4784-958e-4c1dbc238386` completed: v1.2.0, versionCode 8. APK: https://expo.dev/artifacts/eas/n2Qtu1DRYnQ16rOnogjEcVu5OPRaTU1v_zkehdS49Po.apk. SHA-256: `0ec7c3ac61998308600a776d03404a60255868237cd48d90c4a648a7741b7287`.
- Website preview `6icUce7YMQ5DANw38VB6WFMSbasW` built successfully. Production promotion is pending Vercel's ANVIRA email verification. The public production site was checked in the browser and loads all six service categories, current prices and monthly Car Care. The protected preview cannot load its catalogue in this test session; its unauthenticated API requests redirect to Vercel SSO. No proxy or protection changes were made.
- Latest local checks: 385 unit tests, lint/typecheck, customer/office/admin/dispatch/standard-service/features/launch/website/marketing and both customer/staff authentication suites passed; web/iOS/Android exports completed. Legacy test assertions were updated for current selected-service checkout, six service categories and explicit quote validation. CI now tests the staff website after building it.
- Build 8 passed native startup but its emulator screenshot exposed an unloaded catalogue. It is superseded for handover: SDK 58 wraps aborted native requests as a plain Error, bypassing the old safe-read retry check. Two failing regressions reproduced this and now pass; 387 tests plus lint/typecheck pass. Build 9 (`c62ce876-a759-48a6-9f8e-8958082c2747`, source `08682e4`) is queued on the free tier with the correction. The Android workflow is being strengthened to require the live catalogue as well as crash-free startup. The corrected full CI run `45647971178` passed, including Firestore emulator checks. A second native run `45649328054` passed the stronger check and visibly loaded the real service catalogue on build 8 with the server awake. The replacement build 9 retains that flow and fixes safe-read recovery for cold-start timeouts. Physical-device background notification delivery remains unverified. Sleeping free hosting cannot guarantee a strict three-minute wall-clock dispatch deadline.
