# Mobile experience redesign

Goal: inspect and improve the customer application sequentially, keeping real booking, payment, quote and notification behavior intact.

Direction: calm, modern service app using ANVIRA forest green, warm white surfaces, generous legible typography, compact navigation, consistent icons and explicit selected states. Existing Expo 58 / React Native components; no additional dependencies. Existing authorization: user requested complete redesign, one screen at a time and previously delegated design decisions.

## Screen order and verification

- [x] Home: inspect 390px screenshot; compact location header, service discovery first, next booking visible, monthly Car Care distinct, useful service cards. Verify search, category navigation and monthly plan action.
- [x] Services and service detail: inspect screenshot; improve category tiles, readable package choices and fixed action area. Verify package/add-on selections and quote routing.
- [x] Booking flow: inspect each of cart, address/schedule and summary; labelled progress, scroll to step start, proper previous-step header action, clear address choices, readable dates/times, transparent bill and fixed CTA. Verify full booking and demo payment.
- [x] Bookings and booking details: inspect both; clear upcoming/past segments, useful booking cards and empty states, payment/action prioritization and timeline. Verify detail navigation.
- [x] Notifications: inspect inbox before settings, obvious unread states and readable timestamps; notification controls in expandable section. Verify mark read and destinations.
- [x] Profile, addresses, support and cart: inspect individually; grouped account navigation, consistent forms and empty states. Verify navigation and preserved submit actions.
- [x] Verify narrow 320px and 390px English/Telugu layouts, browser errors, lint, typecheck and native runtime regression tests. Record screenshot paths and remaining limitations.

Review focus: Telugu wraps without clipping; no numeric/string children under native View; no actions obscured by keyboard/footer; screen back goes to previous booking step; no fabricated availability, price or business claims.

Implementation notes and screen findings are appended as work proceeds. Existing uncommitted production work is retained in place for the connected Expo Go session.

Results: 359 unit tests, lint and typecheck passed; 24 customer mobile captures/flow checks passed on a fresh demo server; native component layout checks and professional English/Telugu inspection completed. Independent review identified the page-local unread filter empty-state issue; corrected with explicit page-local copy and a browser regression covering older unread pages. iOS and Android export verified. Detailed evidence is in docs/MOBILE-EXPERIENCE-REVIEW.md.
