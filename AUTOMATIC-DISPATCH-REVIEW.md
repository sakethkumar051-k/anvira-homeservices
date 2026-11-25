# Clear validation and automatic dispatch — 25 November 2026

## How to use it

In Admin → Roles & settings → Office dispatch, choose **Use recommended automatic flow**, then **Save dispatch settings**. Paid bookings then use an eligible ANVIRA worker first. When none can cover the exact service, PIN and visit time, approved outside professionals receive offers in groups of five. The first eligible acceptance confirms the booking. Automatic offers use at most two rounds with a three-minute overall deadline; manual overrides remain available.

To stop ANVIRA handling only for a service/area, use **ANVIRA team availability by service**, select the relevant service/PIN pause, then **Save team availability rules**. This does not disable customer booking when eligible partners can cover it. It does not move already assigned visits. Closing the admin site never changes availability.

Each active staff booking has **Dispatch progress** and **Why this assignment?**. These show the reason, timeline, offer responses and push-provider status. Provider receipts do not mean a professional read the alert. Failed/no-device delivery does not extend an offer's deadline.

Admin → Automations → **Dispatch simulator** runs six sample scenarios in a new memory database: ANVIRA available, outside acceptance, no capacity, simultaneous acceptance, no acceptance, and notification failure. It cannot access the live store, send real pushes or move money. The notification-failure scenario exercises the real retry implementation through an isolated failing transport.

## Customer forms

Monthly Car Care now allows Submit to explain missing details. Required answers, description, full address and PIN coverage have field errors and a first-error focus. Successful requests state that no payment was taken. Inputs survive failed requests. Shared input error/help support and reasons beside blocked actions cover quotation/proposal, checkout, service completion, professional onboarding, bank verification, support and admin editors. English and Telugu copy are included.

## Dispatch implementation

Existing settings remain manual until the Owner saves the recommended mode. Company updates preserve other settings; unchanged dispatch permissions do not invalidate offers. Transactions and shared locks enforce the first valid acceptance and prevent overlapping assignment. Matching, checkout and availability paginate beyond 200 approved profiles. The admin diagnostic list explicitly identifies its display limit.

Automatic rounds use a dedicated dispatchDueAt queue so old manual/terminal records cannot block it. The fast clock checks every five seconds only while a deadline is active; payment events wake it and a minute watchdog recovers idle/restarted instances. Notification network requests have an independent guard and cannot hold up dispatch. Queued wakes and overdue batches remain active until processed. These clocks require a running backend; sleeping free hosting cannot guarantee a strict elapsed-time response.

No automatic cancellation/refund policy was added. An unfulfilled paid visit escalates to the office for customer contact, roster review or rescheduling.

## Verification and release

Evidence and browser results: evidence/automatic-dispatch/. Automated verification covers field errors and valid requests, automatic internal assignment, service/PIN pause, outside offer privacy and acceptance, all simulator scenarios, races, expired rounds, roster pagination, push retries, slow push, lost wakes and queue starvation. Release/deployment and device-test outcomes are recorded below after they are observed.
