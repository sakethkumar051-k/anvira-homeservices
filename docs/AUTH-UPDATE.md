# Google and email authentication — 6 October 2026

Phone authentication has been removed from ANVIRA. The live app at `http://localhost:4000` offers Google, email/password, customer registration and password reset. Customer, professional, Owner and Care accounts use the same providers; the server opens only the workspace approved for that account. The separate sample app at port 4001 continues to use clearly labelled sample role buttons.

## Changes

- Removed phone sign-in, verification-code fields, resend timers, phone consent, reCAPTCHA integration, and the native Firebase Auth plugin that existed only for phone CAPTCHA handlers.
- Added Firebase Google popup sign-in on web and the free `react-native-nitro-google-signin` native integration using Android Credential Manager and the iOS Google SDK. No paid sign-in library is used.
- Added email/password sign-in and customer signup with name, minimum eight-character password, confirmation, password visibility, email autofill, inline validation, and duplicate-account recovery. Password reset uses a generic response and a one-minute retry cooldown. Firebase enforces its own provider limits.
- Preserved HttpOnly web sessions, CSRF/origin checks, native Firebase token authentication, disabled-account checks, approved professional roles and Owner/Care claims. Registration has no privileged role selector. Login does not depend on company-policy publication; booking policy gates remain in place.
- Added optional Indian contact numbers in Account settings. They are labelled unverified, never used for authentication, and cannot set a verification flag or account role.
- Updated public OAuth IDs in local environment files, EAS live build profiles and the Firebase environment example. Refreshed native Firebase files and checked the generated iOS Google redirect scheme without writing native directories.

## Real Firebase status

The official [Firebase CLI Authentication configuration](https://firebase.google.com/docs/auth/configure-providers-cli) was deployed with `--only auth` to `anvira-services`, using the authorized business account. Google and Email/Password are enabled. Phone is disabled. Billing is disabled and was not changed. Authentication and Firestore read checks succeed; the existing Owner remains enabled with verified email, an active Owner record and the Owner claim. No sample accounts/bookings were written to the live project.

Selected provider/Owner flags are recorded in `evidence/auth-provider-status.json`. Credentials and private provider configuration are excluded from this report.

## Verification

- Lint and TypeScript checks pass.
- 54 automated API/unit cases pass, including fresh Google/password identities becoming customers, forged Owner claims and profile fields not elevating roles, and contact numbers staying unverified.
- 35 browser scenarios pass: 21 established journeys, 8 service/professional/support scenarios, and 6 new authentication scenarios. Password signup/login/reset tests intercept Firebase transport and use fictional identities, so they do not create live users or send email. The real Google provider reaches Google's account-selection page in a fresh browser; cancellation returns a useful message. No Google credentials are entered and full account completion is not claimed.
- Expo Doctor passes 21/21 checks. Web, iOS and Android bundles export successfully. The Google native dependency compatibility check and Expo config introspection pass; the iOS Google URL scheme is present and the phone-auth config plugin is absent.
- See `evidence/auth-browser-results.json`, `evidence/email-google-signin.png`, `evidence/ui-results.json`, `evidence/new-feature-ui-results.json` and `evidence/native-auth-config.json` for local evidence.

## Cost and remaining setup

Google and email/password authentication can use Firebase Spark, subject to its free quotas and limits. ANVIRA no longer sends authentication SMS. See [Firebase pricing](https://firebase.google.com/pricing) and [Authentication limits](https://firebase.google.com/docs/auth/limits).

This change does not make all deployment services free. Cloud Functions and Cloud Storage need a billing-enabled Firebase project if those services are selected; the existing deployment configuration uses them. Backend hosting and document storage therefore still need a launch decision. Existing payment-provider, catalog, company-policy and support-detail launch gates remain.

Native Google still needs a signed development/release build and Android signing fingerprints registered for the actual EAS/Google Play certificate. The refreshed Android config has its Web OAuth client, but no Android signing OAuth client yet. Do not invent a fingerprint or use an unrelated certificate. Expo Go cannot run these native authentication modules. EAS project/signing and Firebase file variables must be available before a build. Signed-device Google/password checks, email delivery to real mailboxes and final human account completion remain unverified.

The current dependency audit is `evidence/dependency-audit-auth.json`: 44 upstream/tooling advisories (14 moderate, 30 high, no critical). The Google package is flagged through its Expo/React Native dependency chain; no compatible automated fix is offered. Existing dependency mitigation remains intact; no forced downgrade was applied.
