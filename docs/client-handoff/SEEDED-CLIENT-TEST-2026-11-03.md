# ANVIRA seeded client review — 3 November 2026

The hosted Firebase project `anvira-services` now contains 10 customer accounts, 10 partner accounts, five accountless internal workers, 11 SAMPLE services, 40 fictional historical bookings, 10 quote requests, 10 support tickets, 40 conversations, sample test earnings and customer home-care data.

Both existing Owner and Customer Associate logins, their claims and company settings were preserved. Office dispatch is enabled; external fallback starts off and can be enabled by the Owner for testing. Two previous non-staff Auth identities were disabled rather than permanently deleted. Existing business records were archived in the encrypted pre-reset backup before replacement.

## Install and sign in

1. Download the Android review APK: https://expo.dev/artifacts/eas/qmmrz1fnSH94Qem3AfhnCP6ASyL0WenWOzZUGqeA9nM.apk . This is version 1.2.0 / build 5, independently installed/launched on Android 15. Open it through Android Downloads/Files; Expo Go is not used. An APK cannot be installed on an iPhone.
2. Customer: choose email sign-in and copy a Customer row from the private local file `credentials/client-review-20261103.md`.
3. Partner: choose **Professional sign in** and copy a Partner row from that file. Partners 01–08 are approved/available; Partner 09 is deliberately unapproved and Partner 10 unavailable.
4. Coverage PIN: **509216**. All addresses and people are fictional SAMPLE records.
5. Owner/Customer Associate: keep the existing staff credentials at https://anviraservices.com/staff . Refresh once to load the new data.

The private credential file contains 20 unique passwords, is excluded from Git and has owner-only file permissions. Do not publish it or the Auth archive. No passwords or reset emails were sent to anyone.

Seeded historical payment/earnings figures are fictional and have no Razorpay order/payment IDs. No refund jobs, real wallets, bank accounts or payouts were created. Create a **new booking** to exercise real Razorpay TEST checkout, office dispatch, partner offers and provider refunds. Do not treat historical seed records as provider payment evidence.

All 20 email/password logins were verified against Firebase; hosted customer and professional workspace probes returned HTTP200. Owner and Care remained active with matching claims. Source checks passed 303 Node tests, TypeScript and lint. Physical-phone acceptance remains necessary. Disable review accounts and replace SAMPLE business data before a real launch.

## Expo Go preview

The current source also supports Expo Go email/password sign-in through the Firebase JavaScript SDK. Installed builds retain their native Firebase authentication. Use the session QR shown in the chat and the same private customer/partner credentials. This is connected to the hosted test database, not an offline demo. Sign in again after a full reload because Firebase JS credentials remain in memory. Google/Apple sign-in and remote push acceptance require an installed ANVIRA build.

The preview requires SDK 57-compatible Expo Go and this computer/server to remain running. On an iPhone, Expo CLI and Expo Go must use the same Expo account (`sakethkumar051`). The tunnel URL is temporary. Run the preview with `expo start --go --tunnel --no-dev` and the public preview configuration from eas.json; `--no-dev` avoids an SDK 57 development env-context parsing error with the existing nonstandard local env filenames.

Two seeded logins were verified through the Expo Go auth adapter against the hosted backend: customer01 returned the customer workspace and partner01 the professional workspace, both HTTP 200. One additional normal booking reservation was created during slot validation; a subsequent unsupported slot was correctly rejected, so the attempted ten-reservation batch was not completed. Create a fresh booking to test checkout; normal unpaid holds expire.
