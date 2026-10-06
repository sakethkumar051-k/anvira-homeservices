# Continue ANVIRA on your Mac

This is the existing ANVIRA project, version 1.2.0. Keep this codebase and its tests; do not start another implementation.

## Desktop handoff

1. Extract `ANVIRA-current-firebase-source.zip`.
2. Run `START-MAC.command` inside `anvira-app`. If opening a command file is unavailable, run `bash /path/to/anvira-app/START-MAC.command` in Terminal.
3. The launcher copies the project to `~/Desktop/ANVIRA` (or a timestamped folder if one exists), opens Codex or Finder and starts the web demo. Node.js 24+ is required. Stop the demo with Ctrl+C.
4. Select that Desktop folder as the project in Codex. Browser sign-ins in ChatGPT's cloud browser do not automatically authenticate Firebase CLI on your Mac.

No claim is made that the Desktop folder already exists on your Mac: this build was produced on remote Linux, which cannot access your Mac's filesystem. The launcher is executable and shell syntax-checked; macOS behavior needs local verification.

## Product decisions

- Customer and professional experiences for iOS and Android; responsive desktop Owner and Customer Care dashboards.
- Emerald/forest green, mint and ivory; Manrope and Telugu typography. Native Liquid Glass where available, with accessible fallbacks.
- English and Telugu. Real catalog/policy translations need fluent review.
- In-house-first automatic assignment, approved partners, prepaid bookings, bounded reservation holds, acceptance deadlines, duration/travel locks and full refunds for unfulfilled bookings.
- Server-verified roles, Google and email/password for all workspaces, customer registration and password reset. Professionals can switch into their personal customer workspace.
- Published company policies and real prices are required before live bookings. Sample content is intentional demo data.

## Current external setup

The client account `anviraservicesllp@gmail.com` owns Firebase project `anvira-services` (project number `516523404901`), verified in the console. The account-side project setup was completed while development continued. Web (`ANVIRA Web and Admin`), Android (`ANVIRA Android`) and iOS (`ANVIRA iOS`) application entries are registered; both native application identifiers are `com.anvira.services`. Firestore Standard `(default)` was created in `asia-south1` with deny-all client rules. Email/password authentication is enabled. The project remains on Spark without a linked billing account.

Verified public web identifiers are in `deployment/firebase-public.json` and `.env.firebase.example`; `.firebaserc` points at this project. These identify the app and are not administrative credentials. Demo mode stays enabled until the deployed backend and staging gates pass. Native configuration downloads timed out in the browser, so download `google-services.json` and `GoogleService-Info.plist` from Firebase project settings on your Mac and supply them through EAS file variables. Do not fabricate their contents.

Phone authentication is removed and stays disabled. Google and Email/Password are enabled in the real project without changing billing. Native Google requires Android signing fingerprints and an EAS development build; public Web/iOS OAuth IDs and refreshed config files are present locally. Storage, Functions, indexes, hosting, Owner bootstrap, catalog seeding, budgets/backups and live deployment are not completed.

Do not copy the password from the conversation into this repository or `.env`. It is not a Firebase service credential. Use local secure sign-in and cloud-managed identities. Keep each production account under the client's ownership.

## Next development task

Continue from `docs/PRODUCTION.md` and `docs/ACCOUNTS.md`. Complete the permitted project/account setup after the account owner handles the remaining provider terms, billing, verification and enrollment charges. Connect Firebase public web/native configs, initial Owner UID, Razorpay test configuration and Expo/EAS. Deploy staging first. Run Google/email sign-in, checkout, webhook/refund recovery, document, push and role tests; then signed device builds and accessibility/design review.

Remaining code/business work includes partial refunds and dispute accounting, tax invoices with the applicable approved business requirements, in-house payroll if required, bank verification provider integration, full historical search and indexed assignment beyond 200 professionals. Do not silently represent those as already complete. Direct booking text messages, full-history aggregates and operational pagination are implemented in 1.2.

Run `npm ci`, `npm run check`, `npm run export:web`, `npm run test:ui`, `npm run test:firestore` (Java 21+), and `npm run export:all`. Keep meaningful security/business tests and the required dependency patch. Read `AGENTS.md` before changing Expo APIs. Credential integration and physical-device checks remain mandatory; successful simulated tests do not establish a bug-free release.

Console session note: Firebase signed this browser out after setup. Its Sign in control did not advance. Restore the session manually before continuing account configuration. Verified project/database/provider changes above were observed before sign-out.
