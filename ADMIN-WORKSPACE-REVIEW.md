# Admin workspace review — 25 November 2026

The admin website now has a separate responsive workspace, with grouped navigation, a visible language switch, descriptive page headings, keyboard focus styles and a compact mobile menu. Customer screens retain their existing shell.

## Screen-by-screen changes

| Screen | Result |
| --- | --- |
| Overview | Daily totals and linked work queues come first. Setup and launch checks moved to Settings. |
| Orders & dispatch | Status queues query the full booking history with pagination. Each row describes its next action. Search explicitly covers the current page. |
| Quote requests | Status filters for loaded quotes and an explicit proposal editor; customer acceptance and monthly plan behavior retained. |
| Internal workers | Search by name/PIN and availability filters; assignment still checks the actual visit time on the server. |
| Professionals | Approval filters and a deliberate review action; verification and document controls retained. |
| Services | Existing scope/pricing/publication editor retained inside the consistent workspace; monthly subscription wording retained. |
| Payments & refunds | Existing owner-only approval controls retained with clearer page context. |
| Customer support | Open queue first, response-target ordering within each page, one conversation at a time, editable reply templates, and per-ticket drafts retained when switching conversations or completing a delayed send. |
| Reports | Performance, export and staff activity separated; date presets calculate full-history reports using IST. |
| Payouts & reconciliation | Requests, schedule configuration and provider reconciliation are separate tasks. Existing approvals remain in place. |
| Promotional banners | Current/scheduled/ended/disabled status follows inclusive IST dates and destination service availability. |
| Offers | Saved offers appear first; create/edit forms open deliberately and existing values can be edited. |
| Roles & settings | Dispatch, business policies, About, staff access and setup each have their own section and shareable URL. |
| Automations | Owner-only job heartbeat, last run, overdue support and financial exceptions; links lead to the relevant workspace. |

## Automation behavior

New UI behavior includes next-action calculation, status queue links, report date presets and draft reply templates. Existing foreground refresh continues every 30 seconds. Existing server jobs already handle expiry, dispatch deadlines, finance reconciliation, reminders and cleanup; the automation screen reports their recorded health. Opening it never starts a job or approves a transfer.

A successful runner heartbeat does not certify each financial job. Missing or stale heartbeats show attention required, and fetch failures cannot leave a green status visible.

## Verification

- Unit coverage includes full-history status filtering, invalid/unauthorised filters, role navigation, next-action terminal/arrival states and banner date boundaries.
- Browser coverage includes all 14 pages, desktop and 393px layouts, Telugu navigation, owner/care boundaries, status queues beyond 205 recent records, proposal editors, settings/finance sections, report presets and offer editing.
- Support tests verify that templates do not send automatically, drafts survive closing, and a slow send followed by reopening does not reuse a consumed retry key.
- Existing office workflow test covers worker creation, assignment, dispatch, arrival and completion.

Screenshots and test results are in `evidence/admin-workspace/`.

## Release scope

The matching backend snapshot `6cab620` is now live on the existing Render Free service. The `bookings(status, createdAt desc, id desc)` index is READY and the hosted status queue returns 200. Android preview v1.2.0 build 8 has completed. The Vercel website promotion still requires ANVIRA email verification; see `AUTOMATIC-DISPATCH-REVIEW.md` for current rollout evidence and limits.

Final validation: `npm run check` passed (369 tests, lint and typecheck); `test:ui:admin` passed 11 checks with zero page errors; `test:ui` passed 21 scenarios with zero runtime errors; `test:ui:office` passed the internal and partner dispatch flows. Web, iOS and Android exports completed. A fresh read-only review reported no remaining significant findings in the corrected action/draft logic.

Local demo preview: http://localhost:4950/staff (choose Admin / Owner). Expo Go's existing server remains running on port 8083.
