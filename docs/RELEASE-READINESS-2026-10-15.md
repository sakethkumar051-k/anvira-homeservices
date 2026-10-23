# ANVIRA release readiness — 15 October 2026

## Target and constraints

Launch the client-owned public website, Owner/Care portal, Android app and iOS app. Target: 31 October 2026, subject to provider enrollment, verification and review. The client confirms ANVIRA is a registered company and is checking its D-U-N-S number. Developer accounts are not yet enrolled. Developer enrollment fees are approved; hosting must use free services without a payment method. Business/legal content will be supplied later.

This report distinguishes source verification from signed-device and deployed-provider verification. It does not certify a bug-free application or promise store acceptance by the target date.

## Verified current status

| Area | Observed on 15 October | Release status |
| --- | --- | --- |
| Public website | `https://anviraservices.com` and `https://www.anviraservices.com` respond; welcome, About and staff pages render at mobile width | Reachable client preview; hosting plan and approved legal content remain open |
| Admin portal | `/staff` has email/password and reset, excludes customer/professional web access; isolated Owner/Care browser checks pass | Real Owner session and deployed operational acceptance still required |
| API | Same-origin `/api/health` and `/api/ready` return 200; health reports Firebase, Razorpay **test**, payments configured, Storage false, payouts false | Test backend, not a completed production environment |
| Firebase | Read-only Auth, Firestore and indexed dashboard queries succeed; no live records written by these checks | Existing `anvira-services` project connected; staging/production isolation and quota/recovery planning remain open |
| Catalog and policies | Live public catalog is empty; public settings return blank terms/privacy/support phone and `policyPublished:false` | Blocked on actual service catalog, staffed support and approved policy publication |
| Payments | Local Razorpay credentials accepted by read-only provider request; test webhook secret present; no money moved | Real hosted test checkout/refund/webhook journey and live merchant activation remain open |
| Android/iOS source | SDK 57 patches aligned; native/web JavaScript exports compile | No signed release or physical-device acceptance established |
| Native configuration | Local Firebase files exist and app identifiers match `com.anvira.services`; local EAS project ID and Apple enable flag absent | EAS enrollment/project, signing, OAuth fingerprints, Apple provider/capability, APNs/FCM and store records required |

Android's local Firebase configuration has no Android OAuth client entries. Verify signing SHA-1/SHA-256 and the Google OAuth setup in the console, then download an updated configuration; an old downloaded file does not establish the console's current state.

## Changes completed in source

- Updated compatible Expo 57 packages through `expo install --fix`; Expo Doctor now passes 21/21 checks.
- Notification taps now read the cold-start response, retain it until authentication is ready, validate booking IDs, avoid duplicate routing, clear only the consumed response, and cancel scheduled routing on cleanup.
- Live native release runtime rejects a missing, malformed or HTTP API URL instead of accepting the development emulator fallback.
- Release checks now reject unknown targets, require platform Firebase files, and validate a public HTTPS native API origin. Website-only checks allow its intentional same-origin API proxy.
- Added public `/delete-account` instructions and a reviewable email request link, accessible without website customer sign-in. Opening the link sends no message and deletes no data. Added a footer link visible before policy publication. The client still needs to approve retention disclosures and operate the request process before store submission.
- Repaired About → contact navigation to scroll the marketing page to its enquiry form.
- Updated obsolete browser expectations: the website catalog does not expose mobile customer sign-in; publication tests inspect public catalog visibility and unchanged existing booking snapshots; staff-only authentication checks do not attempt a Google button intentionally absent from that portal.

These changes are local source changes. No production deployment, DNS migration, enrollment purchase, live payment or store submission was performed in this pass.

## Client action pack — start enrollment immediately

| Needed from client | What to do / provide | Secure handling |
| --- | --- | --- |
| Legal identity and D-U-N-S | Confirm exact registered entity name, registered address, company documents and whether a D-U-N-S number exists. Ensure registry/D-U-N-S details match. | Share identifiers/status; upload identity documents directly to provider consoles |
| Apple organization enrollment | Authorized company representative enrolls with their Apple Account, 2FA, D-U-N-S, company phone, domain-associated work email and functioning company website. Complete verification, agreements and membership fee. | Account Holder remains the client; use invited roles/certificate access, never a shared password |
| Google Play organization enrollment | Register the actual company; supply its D-U-N-S and matching legal identity/contact details, complete verification and enrollment fee. | Client retains ownership; invite developer access |
| Expo/EAS | Create a client-owned free account/project and grant project access. Supply the public project ID. Set public build variables and private Firebase configuration files in the appropriate EAS environments. | Signing keys, APNs/FCM credentials and store API keys stay in EAS/provider credential stores |
| Firebase/Git/hosting/domain access | Confirm authorized project access and provide invitations or sign in locally. Existing Firebase connection does not grant access to all hosting/store systems. | Do not paste account passwords or service-account keys in chat |
| Merchant readiness | Complete Razorpay business/KYC/live activation. Confirm webhook/capture/refund configuration and support ownership. | Live/test key secrets and webhook secrets belong only on the API host |
| Business pack | Final services, package details, prices, service area PINs, hours, professional capacity, commission, public support phone/email, registered address and final branding/localized content | Publish through Owner settings after review; never seed sample prices/policies into live service records |
| Policies | Approved privacy, terms, cancellation/refund and data retention/deletion rules; approved support response process | Publish public HTTPS pages; data safety/privacy disclosures must match actual integrations |
| Launch financial scope | Confirm whether GST invoices, partner withdrawals/automatic payouts, partial refunds and dispute handling are required on day one | These decisions affect code and onboarding; do not present a booking receipt as an approved tax invoice |
| Testing and store review | Physical iPhone and Android access, representative testers, store listing text, screenshots and dedicated reviewer accounts/instructions | Use disposable test identities; do not give reviewers the Owner account |

Apple organization enrollment requires a domain-associated work email; possession of the separate client Gmail account alone does not complete enrollment. [Apple enrollment](https://developer.apple.com/programs/enroll/)

Google says D-U-N-S applications are free and may take up to 30 days; check an existing number before requesting another. [Google organization account requirements](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)

New personal Google Play accounts require at least 12 testers continuously opted in for 14 days before applying for production access. Account type must reflect the real publisher; it must not be chosen to bypass verification. Enrollment, closed testing where applicable and review make a 31 October public release uncertain. [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

## Hosting under the no-card constraint

Do not enable Firebase Blaze, paid Render/Vercel plans, trials requiring payment details or automatic overage charges without a changed instruction from the client.

The existing preview architecture cannot currently be signed off for production:

- Render explicitly recommends against production applications on free instances. They spin down when idle, have ephemeral filesystems and no persistent disks. The app's financial/background jobs and private documents require a different validated operational arrangement. A 200 health response does not establish reliable scheduling or durable storage. [Render free limits](https://render.com/docs/free)
- Vercel Hobby restricts use to personal, non-commercial purposes. The registered company's commercial site needs suitable hosting. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Netlify Free or Cloudflare Pages are candidates for the static website, subject to current terms, account verification and quotas. They do not automatically replace this Express API, persistent encrypted documents or its minute-level workers. Migration must preserve the API proxy, cookies/CSRF, security headers, checkout routing and custom domain. No replacement was selected or deployed here. [Netlify plans](https://www.netlify.com/pricing/), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

A full no-card backend/storage/scheduler plan is still an open release dependency. Do not use artificial uptime pings as evidence of production reliability or promise continuous operation beyond a free provider's limits. If no suitable validated arrangement is available, keep the website as an enquiry preview and distribute test builds while this constraint is resolved.

## Remaining technical acceptance

1. Set native `EXPO_PUBLIC_API_URL` to the selected reachable HTTPS API; configure EAS project/environments, matching native files, Google signing/OAuth fingerprints and Apple sign-in before building.
2. Deploy reviewed code to staging; verify the same-origin staff session, CSRF rejection, sign-out, password reset and disabled-role behavior on the actual domain. Keep arbitrary preview domains outside the authentication origin allowlist.
3. Run real hosted Razorpay test success/failure/cancel/pending flows, signed webhook retries, full refund/reconciliation and browser-to-app return. Enable live collection only after merchant approval and live configuration verification.
4. Select durable private document storage; verify professional upload/download authorization, restart persistence, encryption and backup/restore using the selected host.
5. Verify scheduled booking expiry/reassignment, refunds, push receipt/retry and cleanup while no user is browsing. Verify alarms and recovery after backend downtime.
6. On actual iPhone and Android devices test cold/warm startup, Google/email/Apple sign-in as applicable, reset/verification, booking/cancel/refund, notification permission/delivery/taps, payment return, media/document pickers, keyboards, safe areas, accessibility, reduced motion, offline recovery and account deletion.
7. Prepare App Store privacy/Google Play Data Safety, age/content ratings, reviewer credentials, support/privacy/deletion URLs, screenshots and listing metadata from approved actual behavior.
8. Review remaining dependency advisories. Current root npm audit reports 34 affected package entries (25 high, 9 moderate, 0 critical), many inherited through build tools. This is not 34 independently validated application exploits. Available npm audit force suggestions would downgrade Expo; do not apply them blindly. Current registry versions of `braces` and `node-forge` remain within their reported advisory ranges. Production API/container dependency exposure needs separate review.

Known limits already documented in `PRODUCTION.md` remain relevant: assignment scanning above 200 professionals, high-volume assisted deletion, partial refunds/disputes, GST invoicing and payroll are not silently declared completed. Push token refresh/re-registration is currently manual. Native notification unit tests do not replace physical-device/router-lifecycle verification.

## Verification record

Use Node 24 (the Mac's default Node is older). Full evidence is in the local ignored `evidence/` directory and `/tmp/anvira-*.log`; these can include diagnostic details and should be scrubbed before sharing externally.

- Final TypeScript, Expo lint and all 90 Node tests passed after the source/test changes.
- Expo Doctor: 21/21 checks passed.
- Browser journeys: 58 passed across the main suite (21), feature suite (8), marketing (9), launch walkthrough (6), website/checkout (4), mocked Firebase email/registration/role authentication (5), and staff-only authentication (5). Publication assertions check actual catalog visibility and unchanged booking snapshots.
- Google network OAuth account-selection check was skipped for deterministic authentication tests. Real native/provider sign-in is not certified by those fixtures.
- Firestore emulator: 4 rules/transaction/aggregation tests passed, plus the 1,094-request emulator stress/soak run passed with no server errors. The separate SQLite stress run also passed. Neither establishes production capacity.
- A temporary Java 21 runtime and alternate emulator port 8187 were used; port 8080 was occupied by an existing process and was not stopped. No system Java installation was changed.
- Local release check correctly fails for missing production native URL/EAS/Apple configuration and live payment mode. Provider/device/policy gates remain open even when a configuration check passes.
- Final Android/iOS/web bundle exports passed. These are JavaScript/Hermes compilation checks, not signed native builds. Firebase Functions staging generation passed; no Functions deployment was attempted.

## Completion record

The audited source hardening pass is verified locally. Store release and full production acceptance remain blocked by the external prerequisites above. The current source is not yet deployed to the public domain. Do not remove staging labels or activate production collection based only on local test results.
