# Phone sign-in — 16 November 2026

Customer sign-in now starts with an Indian mobile number and a six-digit Firebase SMS code. Google, Apple on supported installed iOS builds, and email/password remain available. Staff and professional sign-in retain their approved-account flow. The client does not generate or accept its own codes.

## Implemented behavior

- Web pre-renders Firebase invisible reCAPTCHA during number entry. SMS sends only after the user presses Get verification code. Each send gets a fresh CAPTCHA token, including retries.
- Installed iOS/Android builds use React Native Firebase’s v26 modular `verifyPhoneNumber` listener for initial sends and forced resends. Instant native verification finishes directly; once a code is sent, only the current explicit confirmation can mutate the account. Late callbacks from an abandoned number cannot sign it in.
- One code input supports SMS autofill, paste, inline failures, number correction and a 60-second resend cooldown. A confirmed identity token is retained in memory if API session completion needs retry, avoiding a second SMS verification.
- Authentication initialization no longer hides number entry while the API restores an existing session. Existing browser HttpOnly sessions, CSRF checks, native token transport and approved role checks remain.
- Safe `returnTo` links reopen service/checkout paths with an optional `packageId`, the booking list, or a service quote request. External URLs, dashboard routes and arbitrary query strings are rejected. Existing Google/email identities are not merged automatically from unverified contact numbers; returning customers should use their original sign-in to keep their existing booking history.
- The API trusts only the Firebase token's verified `phone_number`. It persists the number and verification flag, and refuses self-service replacement of a verified sign-in number. Entering a contact number through Profile cannot verify it or change account permissions.
- Expo Go cannot host the native phone-auth verification setup and explains the installed-app requirement; email remains available.

## Required live configuration

On 17 November 2026 (India time), the approved project configuration update enabled Phone and restricted SMS sending to India (`IN`). A private prechange backup was saved, and a fresh GET confirms the change with unrelated configuration unchanged; see `evidence/phone-auth-configuration.json` and `evidence/phone-auth-readiness.json`. The existing service identity receives `403 PERMISSION_DENIED` when reading Cloud Billing, so current billing status is unverified. Earlier billing-disabled evidence is historical. Billing, OAuth clients, app verification and authorized domains were not changed, and no live SMS was sent. The deployed `anviraservices.com` / `www.anviraservices.com` domains are absent from the current Firebase authorized-domain list; authorize whichever domain will serve the phone flow before release.

1. Phone is enabled and India is the only allowed SMS region. Real verification SMS requires the Blaze plan; verify the business account’s current billing plan and configure its budgets/quotas. No billing change was made by this task.
2. Authorize the deployed web domain. Firebase's web phone-auth guide states localhost is not an accepted hosted phone-auth domain; use fictional-number tests/emulators locally and an authorized HTTPS domain for real acceptance. Web CSP must permit Google's reCAPTCHA scripts, frames and requests.
3. Register the actual Android development/release/Play signing fingerprints: SHA-256 for Play Integrity and SHA-1 for the reCAPTCHA fallback. Use refreshed matching Firebase config files, never invented fingerprints.
4. Upload an APNs authentication key/certificate for the iOS app in Firebase. Expo config enables background remote notifications and the RNFirebase Auth plugin for the reCAPTCHA return scheme. Create a fresh development/release binary with the matching Firebase files. Test both silent app verification and the reCAPTCHA fallback on signed devices.
5. Test with Firebase fictional phone numbers first. Do not disable app verification in release code. Automated browser tests replace external CAPTCHA/SMS transport and use fictional credentials; they send no real SMS and cannot establish real delivery time.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo Firebase](https://docs.expo.dev/guides/using-firebase/), [RNFirebase phone authentication](https://rnfirebase.io/auth/phone-auth), [Firebase web setup](https://firebase.google.com/docs/auth/web/phone-auth), [Android app verification](https://firebase.google.com/docs/auth/android/phone-auth), [iOS app verification](https://firebase.google.com/docs/auth/ios/phone-auth), [SMS limits and billing](https://firebase.google.com/docs/auth/limits).
