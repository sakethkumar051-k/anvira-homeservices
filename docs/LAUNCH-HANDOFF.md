# Launch implementation and remaining gates

This change prepares a richer product demo and production support code. It does not certify a public launch. No Firebase billing changes, payment-provider transactions, Apple-provider activation, or external messages were made. Ten inactive sample catalog drafts were added to Firebase for Owner review; no fictional customer/professional identities, bookings or policies were created there.

## Implemented in the application

- Ten service-specific sample definitions with packages, price/scope explanations, exclusions, meaningful options, customer questions, FAQs, preparation and completion tasks; a completed partner job with commission/wallet history.
- Owner-editable required customer questions; server validation and immutable booking snapshots. Car model and parking location are required for car cleaning; vehicle registration and identity data are not requested.
- Guest catalog at `/catalog`, showing only active service definitions and area PINs.
- Booking drafts and unsent booking messages: tab-scoped storage on web, chunked encrypted SecureStore on mobile; seven-day expiry and logout cleanup. Drafts never reserve slots or submit automatically. Storage failures leave the form usable and booking failures preserve user input.
- Focus/foreground updates every 30 seconds; open conversations check every five seconds. These are bounded polling intervals, not a socket stream. Hidden/background screens stop polling. Monitor Firestore reads when increasing customer volume.
- A professional can open the service address in Maps without a paid Maps SDK; it is a map deep link, not GPS ETA tracking.
- Quality/revisit entry from completed bookings into a linked support request; response targets and overdue escalation to active Owner/Care accounts. Resolution and customer reopening remain audited. Targets are operational goals, not legal guarantees.
- Firebase email-verification links during registration and an account resend action with a cooldown. Verify the sender/domain and spam delivery before launch. Customers are not silently prevented from booking solely because verification mail fails.
- iOS Apple sign-in implementation with a random nonce, SHA-256 challenge, Firebase credential exchange and Apple revocation on account deletion. Native button stays hidden until `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` and Apple is available. Requires Apple Developer capability, Firebase Apple-provider configuration, signed-device tests, private-email relay setup and store review. It has not been activated or proven on a device.
- Standalone API worker every minute for reservation expiry, assignment deadlines, refunds, reconciliation, push delivery/receipts, cleanup and support escalation; worker heartbeat and Owner readiness checks. `RUN_BACKGROUND_JOBS=false` disables it when an external scheduler is used. Firebase Functions scheduling remains an alternative. Keep the API continuously running; a sleeping free host cannot guarantee deadlines.
- Public `/api/ready` dependency probe, request correlation IDs, structured slow/error logs and Owner-only instance telemetry. External uptime monitoring and alert recipients must still be configured.
- Optional private document storage on a persistent server volume, encrypted with AES-256-GCM, short-lived signed download links, file permissions and authorized URL issuance. This avoids Firebase Storage billing. It needs a persistent private volume, reliable backups and a separately protected key. Every API replica must share that volume. Ephemeral serverless disk is unsuitable.
- Encrypted logical Firestore backup export, validation and guarded additive restore scripts; encryption/tamper/project-isolation/round-trip tests. Exports are not point-in-time consistent under concurrent writes. Stop booking writes for a consistent restore/export; test on a recovery environment. Auth identities and encrypted document-volume contents need separate backup procedures. A key stored alongside a backup defeats its protection.
- Standalone Node 24 deployment Dockerfile and corrected CI: separate demo/live exports, backend checks, customer/professional/Owner/Care browser flows and Firestore rules checks.
- Payment web pages moved to `/payment-checkout/:token` so service customization at `/checkout/:serviceId` can be opened or refreshed. Existing 64-character legacy payment links remain supported.

## Standalone deployment without Firebase Functions/Storage

Build the live web bundle with public Firebase/OAuth identifiers and your HTTPS API URL. Run `npm run check`, `RELEASE_TARGET=web npm run check:release`, then `npm run export:web`. Build the image with `docker build -f deployment/Dockerfile -t anvira .` after the export. Docker execution was not available/verified in this workspace. CI uses fake public Firebase identifiers and mocked authentication transport; real Google-provider verification remains a separate check.

Provide runtime secrets through your host's secret store, never in `EXPO_PUBLIC_*` variables. Use least-privilege server Firebase credentials. Configure `PUBLIC_API_URL`, `WEB_APP_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY` for the chosen reverse proxy, Firebase project, Razorpay keys and webhook secret. Set up HTTPS before accepting customers.

For portable private documents, configure `PRIVATE_DOCUMENT_DIR=/var/lib/anvira/documents`, a protected 32-byte base64 `DOCUMENT_ENCRYPTION_KEY`, and `PERSISTENT_DOCUMENT_VOLUME=true` only after attaching a persistent volume. Keep this directory outside the static web root. Alternatively configure Firebase Storage, which currently requires billing. This adapter does not remove the cost or responsibility of hosting the volume.

For backups, configure a separately protected 32-byte base64 `BACKUP_ENCRYPTION_KEY`. Run `npm run backup:data -- export /private/location/snapshot.enc`, then `npm run backup:data -- verify /private/location/snapshot.enc`. Restore defaults to a review/dry-run error and requires `--apply-to=<exact Firebase project ID>`. It overwrites matching records in batches, retains unrelated records and is not atomic. After a production restore, reconcile financial job state with payment-provider records before restarting workers. A local encrypted 15-document snapshot was exported and verified on October 6, 2026; no live restore was performed. Local private document storage is configured on this Mac. A public deployment must mount its own persistent volume and transfer the protected keys securely. Store encrypted snapshots off-site and rehearse recovery before launch.

## Required external/business work

- Choose hosting and domain, configure HTTPS and authorized OAuth/Firebase domains, deploy the API/web bundle and database indexes/rules, then prove cross-device behavior. Firebase Auth/Firestore Spark quotas still apply; hosting can carry its own cost.
- Approve real service prices, scope, repair quotation rules, tax/receipt handling, coverage, cancellation/refund/revisit policies and actual available staff. The live project has ten inactive service drafts and no approved professionals. Review the real scope/prices and approve the sample content in each service editor before publishing. The demo does not supply real business staff.
- Publish legally approved terms/privacy links, staffed support contact and operating hours. Do not use sample warranty text as an actual business promise.
- Configure Razorpay merchant keys and webhooks. Verify one real capture, failed payment, refund and reconciliation before accepting paid bookings. Partial refunds, tax invoices and chargeback/dispute operations require a business-specific design and verification; current refund workflow is full refund.
- Configure EAS project/signing, Android signing SHA/OAuth clients and Apple capability/provider/private relay. Create development/release builds and test Google/email/Apple sign-in, account deletion and notifications on physical iOS/Android devices. JavaScript export is not a signed-device test.
- Prove APNs/FCM push delivery; web browser push, GPS ETA tracking, chat attachments and calling are not implemented in this patch. The existing in-app notifications and text conversations work independently of those channels.
- Configure alerts, off-site backups, credential/key recovery and a recovery rehearsal. Run the deployment/CI in a Git repository (this folder has no `.git` directory).
- Resolve or formally assess the dependency audit: reduced on October 7 to 34 findings (25 high, 9 moderate) from 44. Compatible dependency and Expo SDK patch updates were applied; remaining braces/node-forge/UUID advisories need review. Force-fixing currently proposes incompatible Expo/RN dependency changes. Do not force downgrade an SDK to hide the report.

These gates are shown separately from the working local demo. Billing and account-owned setup remain deferred as requested.

## October 7 website, payment and stress-test update

The public website at `/welcome` and its mobile layout, active-catalog discovery and `/sign-in` entry are implemented. Client-owned Vercel static hosting plus a separate continuously running API is configured in `vercel.mjs`; API/payment routes proxy before the SPA fallback. No client Vercel team or public API host has been connected. See `DEPLOYMENT-PLAN.md` and `.env.vercel.example` for exact setup.

Razorpay test/live mode checks, test banners, read-only credential diagnostics, provider failure/load/verification recovery and a live-key release gate are implemented. Razorpay account/test keys are unavailable; no actual provider checkout or refund was certified and no onboarding/PAN requirement was bypassed.

Both the local SQLite API and local Firestore emulator passed 1,094-request runs, including 50 concurrent read requests, write contention, idempotent retries, replayed signed webhook fixtures, a short paced soak and controlled burst limits. Four actual emulator security/transaction tests now pass. See `STRESS-REPORT.md` for scope, timings and limits. Real deployed/cloud load testing still requires a staging host and provider access.

The Android APK demo preflight now requires a reachable separate HTTPS demo API and the client's EAS project; emulator localhost cannot work on the client's phone. No Android build was started. `CLIENT-BUSINESS-DECISIONS.md` lists the decisions to collect from tonight's client meeting.

## Verification on October 6, 2026

- Lint, TypeScript and 62 backend/unit tests pass. The four browser suites pass 41 scenarios covering customer, professional, Owner, Care and authentication screens, with no recorded runtime errors.
- Web, iOS and Android JavaScript exports pass; Expo Doctor reports 21/21 checks. Native exports do not verify device behavior or signing.
- Firebase indexes were deployed and its rules compiled successfully. Firestore emulator tests were not run locally because Java is unavailable; CI includes them but has not run from this folder.
- Both local servers return successful health/dependency checks. The demo exposes ten services. The Firebase customer catalog exposes no sample drafts; four unreviewed samples found enabled during final verification were returned to draft. Public catalog, customer snapshots and new-booking availability now reject unreviewed live sample definitions independently of their active flag.
- No server document/backup encryption keys were found in the 115 exported public artifacts scanned. The encrypted 15-document backup was validated without restoring it to Firebase.
- The release configuration check still fails for public HTTPS/API configuration, payment credentials, EAS and Apple setup. This is an explicit launch gate, not a passing production certification. Docker, signed-device tests, live payment/refund certification and external alert delivery remain unverified.
