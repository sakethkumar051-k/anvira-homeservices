# Six-service implementation review — 18 November 2026

## Reference inspection and resulting behavior

Urban Company was inspected after the user completed mobile verification, including its cleaning requirements, AC, RO, plumbing, electrical and car-cleaning journeys. The relevant patterns were compact photographic categories, requirement questions before choosing scope, service/package cards, inclusion and exclusion details, preparation/FAQ content and a visible booking action. Public home-service cleaning references were also compared. Inspection stopped before a purchase; no service was ordered.

Reference pages retained in the inspection session include [Urban Company plumbing](https://www.urbancompany.com/delhi-ncr-plumbers-density) and [Urban Company car cleaning](https://www.urbancompany.com/varanasi-car-cleaning). ANVIRA uses its own identity, authored copy and locally hosted representative photography. These are web/mobile-web reference observations, not a claim that every native Urban Company screen was captured.

The implemented customer flow is discovery → category → published service and scope → selected package or quote request → mobile sign-in → original checkout/quote destination. Existing address, availability, payment, booking status, support and account routes remain connected. Quote-only services hide internal amounts and package prices; the server requires a quote before booking. Campaign banners link to the relevant care category without fabricated discounts or ratings.

## Data and authentication

The cloud contains exactly six active services after the guarded migration. Reviewed AC pricing was preserved. The other five services use quote requests until actual prices are approved. Archived catalog records remain stored. Two runtime bookings, staff records, settings and all Firebase Auth accounts were preserved. Cleanup removed 244 proven seed records using a verified encrypted prechange backup; see [cleanup record](FOCUSED-SERVICES-AND-SEED-CLEANUP.md).

Firebase Phone is enabled and sending is restricted to India. Web uses Firebase reCAPTCHA; installed apps use the native Firebase verification flow. Only verified Firebase token claims can establish a verified phone number. Sign-in supports code errors, number correction, resend cooldown and retrying the API session without another SMS verification. See [phone setup](PHONE-AUTH.md).

## Verification

- Full Node/API suite: 337 passed, 0 failed. The suite runs isolated local API servers; sandbox-blocked localhost attempts were rerun with localhost access.
- Expo lint, strict TypeScript and diff whitespace checks passed. Final web, iOS and Android JavaScript/Hermes exports passed; these are not signed native binaries.
- Browser discovery checks cover all six phone categories, loaded photography, no horizontal overflow, search, empty-state recovery, actual catalog PIN coverage and selected-package sign-in continuation.
- Browser authentication checks cover 11 scenarios with fictional Firebase phone/email transport, plus the real Google account-selection/cancellation boundary, including wrong-code recovery, number changes, workspace retry, stale restore protection, email alternatives and approved staff/professional roles.
- Read-only independent release review found no actionable regressions in web discovery, quote pricing, deployment routing and Customer/SignIn integration; 16 focused tests passed.

Screenshots and machine-readable evidence are stored locally in ignored `evidence/`. `npm run test:ui:six-services` runs discovery checks; `npm run test:ui:auth` runs fictional-provider authentication checks. Set `CHROMIUM_EXECUTABLE` to the installed Chrome executable where Playwright Chromium is unavailable.

## Remaining release work

The connected Vercel API account lacks the `anvira2` team grant and its suggested authorization endpoint returns 404. The client’s authenticated browser dashboard was subsequently reached, allowing the verified source to proceed to publication. The website and API have now been published together; deployment IDs and public readiness checks are recorded in DEPLOYMENT-PLAN.md.

Real SMS delivery, current Firebase billing status and signed-device app verification remain unverified. Billing was not enabled or changed. Native phone acceptance needs actual Android signing fingerprints and iOS APNs configuration, followed by a signed device build. The confirmed root HTTPS domain is authorized and its real reCAPTCHA initialization was verified; real phone delivery and completion still need acceptance testing. No live SMS, customer payment or service purchase was sent by the automated checks.

Published review: [ANVIRA](https://anviraservices.com). The public readiness, six-service catalogue and CSRF endpoints return HTTP 200. The local screen gallery contains 17 screenshots, including published discovery, RO quote detail and phone entry plus isolated six-service/category and fictional OTP/package-flow evidence.
