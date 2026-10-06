# Client-owned website and Android demo

## Website

GitHub repository: https://github.com/sakethkumar051-k/anvira-homeservices

The Expo website has a public `/welcome` page and `/sign-in` entry. `vercel.mjs` exports the routing/build configuration from `deployment/vercel-config.mjs`. The root URL redirects to `/welcome`; service links, account routes and refreshes use the single-page export. API and secure-payment routes proxy to the separate API origin before the SPA fallback.

1. The client owns the Vercel project/team and grants access or imports the GitHub repository using its GitHub integration. A repository on the developer's GitHub can be used by the client's Vercel project if that integration is authorized for it; moving repository ownership is optional. Do not sign in with the client's password or purchase a plan on their behalf.
2. Deploy the API Docker/service on a continuously running host. Attach a persistent private document volume, separate Firebase server credentials and protected encryption/payment keys. Configure HTTPS, `PUBLIC_API_URL`, the final website `WEB_APP_URL` and exact `ALLOWED_ORIGINS`; set `TRUST_PROXY` for the verified proxy topology. Keep the worker running and add external monitoring/alerts/off-site backups.
3. Configure the Vercel build variables in `.env.vercel.example`. Set `ANVIRA_API_ORIGIN` to that public HTTPS API origin. Public Firebase/OAuth configuration is required for Firebase builds; secrets belong only on the API host. The website build deliberately leaves `EXPO_PUBLIC_API_URL` empty so session cookies and CSRF work through same-origin proxy requests. Add the website hostname to Firebase authorized domains/OAuth configuration.
4. Import with framework Other and Node 24; repository configuration sets `npm ci`, `npm run build:website` and `dist`. API host and website must be for the same Firebase project. Keep previews isolated from live records; never point a public demo at production staff/financial data.
5. Validate deep-link refresh, sign-in/out, cookies/CSRF, professional document download, checkout return, webhook capture/refund, background heartbeat and recovery after deployment. The local configuration/proxy tests do not certify Vercel's deployed behavior.

The API uses a persistent document volume and minute-level jobs. These must not be moved onto ephemeral Vercel function disk or a daily-only Hobby cron. Vercel Hobby is restricted to personal non-commercial use; the client must choose a plan suitable for its business website. No paid plan or hosting account is activated by this work.

Official references: https://vercel.com/docs/project-configuration/vercel-ts, https://vercel.com/docs/plans/hobby, https://vercel.com/docs/cron-jobs/usage-and-pricing

### Current import status

Source is pushed to `main` in the repository above. Chrome's client account `anviraservicesllp-5725` has opened the repository import in the `anvira` team (team slug `anvira2`), with preset Other. The public Firebase build values are filled in the import form. This form has not yet created a successful deployment: the API is local-only, `ANVIRA_API_ORIGIN` is missing, and the team currently uses Hobby. Do not enter localhost or an invented API hostname to make deployment appear complete.

For a Render API host, import this repository as a Docker web service with Dockerfile `deployment/Dockerfile` and repository-root build context. The API image does not require the ignored `dist` website export. Select Singapore and an always-running compute plan with a persistent disk only after the client reviews the cost. Set `/api/ready` as the health-check path. Mount the disk at `/var/lib/anvira`, configure `PRIVATE_DOCUMENT_DIR=/var/lib/anvira/documents` and `PERSISTENT_DOCUMENT_VOLUME=true`, and keep one instance while documents use this single-host volume.

Add the approved Firebase server credential as a Render secret file named `firebase-service-account.json`; set `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json` and `FIREBASE_PROJECT_ID=anvira-services`. Never upload the Mac's broad personal Google application-default credentials. Generate and preserve the document/backup encryption keys separately in the protected API environment. Set `NODE_ENV=production`, `APP_MODE=firebase`, `PAYMENT_MODE=razorpay`, `RAZORPAY_ENVIRONMENT=test`, `RUN_BACKGROUND_JOBS=true`, exact `WEB_APP_URL`/`ALLOWED_ORIGINS`, the assigned Render HTTPS origin as `PUBLIC_API_URL`, and verified proxy settings. Missing Razorpay credentials must leave payment collection unavailable; they are not simulated in Firebase mode.

Once the API is reachable, set Vercel `ANVIRA_API_ORIGIN` to its root HTTPS origin and complete deployment. Verify document write/read after a restart and an off-site encrypted backup/restore before approving production. Render persistent disks require paid compute, permit one service instance, and cause a brief redeploy interruption. Docker itself is not installed on this Mac, so the image build and deployed volume permissions remain unverified until the chosen host builds it.

Official Render references: https://render.com/docs/blueprint-spec, https://render.com/docs/disks, https://render.com/docs/configure-environment-variables

## Razorpay test mode

The integration creates server-side INR orders, verifies HMAC signatures and captured amount/currency/order, handles signed duplicate webhooks and reconciles refunds. `RAZORPAY_ENVIRONMENT=test` requires `rzp_test_` keys; a mismatched test/live key fails configuration. Screens show payment test mode; payment-network failures remain pending and never become a paid booking.

No Razorpay account/test credentials are available. An in-app simulation and protocol fixtures are separate from Razorpay's real hosted test checkout. We cannot claim a provider test succeeded until the client supplies access. Current Razorpay onboarding asks for PAN depending on business type. The client must use its actual legal business details or ask Razorpay support to unlock test access; do not invent details or choose a different legal type to bypass onboarding.

After access: generate Test Mode keys, store `.env.razorpay-test.example` values in the API secret environment, set a separate test webhook at `/api/webhooks/razorpay`, and enable automatic capture. Run `npm run check:razorpay` for a read-only credentials probe. Make successful and failed hosted test payments, verify replay/wrong-signature rejection, capture/expiry behavior and a full refund. Store only redacted evidence. Test keys simulate transactions; no real money moves. A public production release requires live keys and merchant verification; `RELEASE_CHANNEL=staging` labels a test release check.

Official references: https://razorpay.com/docs/payments/set-up, https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/, https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Android client APK

The `demo` EAS profile already produces an internally distributed APK. It must point at a reachable **separate public HTTPS demo API**, not localhost or the Android emulator address. Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_EAS_PROJECT_ID` in the EAS development environment. Keep `EXPO_PUBLIC_AUTH_MODE=demo` for the fictional client demonstration. Run `npm run check:android-demo` with the same values locally, then `npx eas-cli@latest build --platform android --profile demo` when ready. No build is started automatically; the user said they will start it after tests.

An APK JavaScript export is not a signed physical-device test. Install the EAS APK on the client's phone and verify customer, professional, Owner and support flows, uploads, maps, connectivity loss and payment returns. Firebase sign-in/push production builds additionally need the correct Android Firebase config, signing SHA/OAuth configuration, notification credentials and approved live business settings.

Official reference: https://docs.expo.dev/build-reference/apk/
