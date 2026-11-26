# ANVIRA — App Store and Google Play submission guide

Prepared 26 November 2026 for app version 1.2.0 (bundle/package `com.anvira.services`).

The code and build configuration are ready for store review. The items in **Section 1** are account and console steps only you can do. Skipping any of them is the most likely cause of a first-time rejection.

## 1. Must do before you submit

| # | Step | Why it matters |
| --- | --- | --- |
| 1 | **Switch Razorpay to live keys** on the API host (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ENVIRONMENT=live`), register the live webhook, then redeploy. | While test keys are active, the app shows "PAYMENT TEST MODE · NO REAL CHARGES". Apple rejects apps that look like demos or betas (guideline 2.1/2.2). |
| 2 | **Move the API to an always-on Render plan** (Starter or higher). | On the free plan the API sleeps after 15 minutes and the first request can take a minute. A reviewer who sees a long spinner reports "app did not load" (2.1). |
| 3 | **Enable the Apple sign-in provider** in Firebase Console → Authentication → Sign-in method → Apple. Then test it on an iPhone. | Release builds now show Sign in with Apple next to Google, as guideline 4.8 requires. It must actually work. |
| 4 | **Register Play signing keys in Firebase.** After the first upload to Play Console, copy the SHA-1 and SHA-256 from *Setup → App signing* (both the app signing key and the upload key) into Firebase → Project settings → Android app. Then download the new `google-services.json` and update the EAS file variable `GOOGLE_SERVICES_ANDROID`. | Without these keys, Google sign-in and phone verification fail for anyone who installs from Play. |
| 5 | **Create a reviewer account.** In the app, choose *More sign-in options → Use email instead → Create account*. Then complete one booking with it (you can cancel it afterwards). Optionally, add a Firebase **test phone number** (Authentication → Sign-in method → Phone → Phone numbers for testing) for phone login. | Reviewers outside India cannot receive Indian SMS codes. Without working credentials, the app is rejected under 2.1. |
| 6 | **Fill in `BUSINESS.address` and `BUSINESS.grievanceOfficer`** in `src/lib/legal.ts`, have the business approve the Privacy Policy and Terms, then redeploy the website. | Indian law (IT Rules 2021, Consumer Protection E-Commerce Rules 2020) expects a published address and grievance officer. The policies also commit to acknowledging complaints within 48 hours and resolving them within 30 days, and to raising quality concerns within 7 days. Confirm the business can meet these. |
| 6b | In **Vercel → Project → Settings → Environment Variables**, change `EXPO_PUBLIC_RELEASE_CHANNEL` from `staging` to `production` and redeploy (after step 1). | Every website page, including the Privacy Policy that reviewers open, currently shows "Client preview · test mode". |
| 7 | In **Admin → Roles & settings**, set the Terms URL to `https://anviraservices.com/terms` and the Privacy URL to `https://anviraservices.com/privacy`. | The old `/review-*` links already show the new policies in live builds, but clean URLs are better for store listings. |
| 8 | **Google Play account type.** If the Play developer account is a *personal* account created after November 2023, Google requires a closed test with at least 12 testers for 14 days before production access. | An organization account (needs a D-U-N-S number) skips this. Plan the timeline accordingly. |
| 9 | Test a **preview build on one real iPhone and one Android phone**. Check sign-in (phone, Google, Apple, email), a live payment, notifications, profile photo upload and account deletion. | No automated test covers real devices, real providers or push delivery. |

## 2. What was fixed for store review

- **Launch crash:** production builds had no API address and stopped at startup with "Live app releases require an HTTPS API URL". The address is now in the production profile, and cloud builds fail early if it is missing.
- **Policies:** the published privacy policy and terms were labelled *REVIEW-ONLY / TEST ENVIRONMENT*. Real policies now live at `/privacy` and `/terms`, and the old links show them in live builds.
- **Sign in with Apple** is now enabled in release builds (guideline 4.8).
- **Icons and launch screen:** they used the 1 MB logo containing the "HOME PATNER" typo. New icons are built from the brand mark without the tagline: an opaque 1024 px iOS icon, an Android adaptive icon with a monochrome layer, and a splash screen. To regenerate them, run `node scripts/generate-app-icons.mjs`.
- **Android permissions:** blocked storage, media, camera, microphone and overlay permissions. Profile photos use the system photo picker, which satisfies Google Play's photo and video permissions policy.
- **iOS export compliance:** `ITSAppUsesNonExemptEncryption = false` is set, so App Store Connect does not ask about encryption on each build.
- **Light mode:** `expo-system-ui` added so light mode is applied consistently on Android.

Verified: typecheck, lint, 388 unit tests, expo-doctor 18/18, a production export for iOS, Android and web, and a native prebuild. The prebuild confirmed the permissions, Info.plist keys, icons and splash. The release gate (`scripts/check-release.mjs`) passes for iOS and Android except for the live Razorpay keys.

## 3. Build and submit

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

The first iOS submission asks for your Apple ID and App Store Connect app. The first Android submission needs a Google Play service-account key, or you can upload the `.aab` manually in Play Console. Send iOS to TestFlight and Android to Internal testing first, and install from there before sending for review.

## 4. App Review notes (paste into App Store Connect / Play Console)

> ANVIRA is a home-services marketplace in India. Customers book cleaning, car care, AC service, water-purifier service, plumbing and electrical visits performed in person at their home. Payments for these physical services use Razorpay (guideline 3.1.3(e)); there is no digital content or in-app purchase.
>
> Test account (email sign-in): open the app → "More sign-in options" → "Use email instead" → email: `<REVIEW EMAIL>` password: `<REVIEW PASSWORD>`.
> The service area is PIN code 509216. Use it as the address PIN when booking.
> You can browse all services without signing in ("Browse services without signing in").
> Account deletion: Profile → Account settings → Delete my account.
> Partner sign-up ("Work with ANVIRA") is for local service professionals and requires document verification by our team.

## 5. App Store Connect — App Privacy answers

Tracking: **No**. The app has no advertising or analytics SDKs and does not track users across apps.

| Data type | Collected | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact Info: Name, Email Address, Phone Number, Physical Address | Yes | Yes | App Functionality |
| Financial Info: Other Financial Info (partner bank details for payouts) | Yes | Yes | App Functionality |
| Purchases: Purchase History | Yes | Yes | App Functionality |
| User Content: Photos (professional profile photo), Customer Support, Other User Content (messages, reviews) | Yes | Yes | App Functionality |
| Identifiers: User ID, Device ID (push token) | Yes | Yes | App Functionality |
| Other Data: identity and skill documents (professionals only) | Yes | Yes | App Functionality |

Card and UPI details are entered on Razorpay's checkout and never reach ANVIRA. Privacy Policy URL: `https://anviraservices.com/privacy`.

Age rating: answer **None** to every content question; the result is 4+. Category: **Lifestyle**.

## 6. Google Play — Data safety answers

- Data collected: Name, Email address, User IDs, Phone number, Address; Purchase history; Other financial info (partners); Photos; Files and docs (partner verification); In-app messages; Other user-generated content (reviews); Device or other IDs.
- Purpose for all: **App functionality** and **Account management**, plus **Fraud prevention, security and compliance** for identity documents.
- Shared with third parties: **No**. Firebase, Razorpay, Expo and the hosting providers act as service providers, which Play does not count as sharing.
- Collection is required for account and booking data. The photo is optional.
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, in the app, and at `https://anviraservices.com/delete-account`, which is the account deletion URL Play requires.
- Content rating questionnaire (IARC): category *Utility, productivity, communication or other*; no objectionable content.
- Target audience: **18 and over**. This keeps the app outside the Families policy.
- Ads: **No**.
- App access: choose *All or some functionality is restricted* and enter the reviewer credentials from Section 4.

## 7. Store listing checklist

- App name: **ANVIRA – Home Services** (30 characters max on iOS).
- Short description (Play, 80 characters max): *Book trusted home cleaning, car care, AC, RO, plumbing and electricians.*
- Screenshots:
  - iPhone 6.9" (1320 × 2868) and 6.5" (1284 × 2778): at least 3.
  - Android phone: at least 2 (1080 × 1920 or larger).
  - Show home, service detail, checkout, booking tracking and support.
  - Do not show test-mode banners.
- Play feature graphic: 1024 × 500.
- Support URL: `https://anviraservices.com/welcome`. Marketing URL is optional.
- Do not mention Android in the iOS listing, or iOS in the Play listing.
