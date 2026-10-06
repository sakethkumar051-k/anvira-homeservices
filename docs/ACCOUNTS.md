# ANVIRA client-owned accounts

Account inventory prepared on 5 October 2026 (India). Login/password possession does not complete organization verification, billing enrollment, payment-provider approval, legal acceptance or application signing. No paid enrollment has been purchased.

| Account                                          | Why it is needed                                                       | Current status / next step                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google / Firebase / Google Cloud                 | Auth, Firestore, private documents, API functions, hosting and billing | Project `anvira-services` verified. Web/Android/iOS registered, private Mumbai Firestore created and email/password enabled. Google and Email/Password are enabled; phone sign-in is removed. Storage and deployment remain pending. |
| Expo / EAS                                       | Cloud builds, signing, native push and app distribution workflow       | No client EAS account/project connected. Use a client-controlled Expo organization and save the public EAS project ID.                                                                    |
| Razorpay merchant account                        | Customer payment collection, refunds and settlement                    | No merchant account connected. Start with test keys. Client completes business/bank verification and activation before live money.                                                        |
| RazorpayX                                        | Optional automated partner withdrawals                                 | Not connected; payout feature disabled. Separate activation, approved payout account and static IP egress are needed.                                                                     |
| Apple Developer organization + App Store Connect | Sign/distribute iPhone app                                             | Not connected. Authorized client representative completes legal enrollment, identity/company verification and membership purchase.                                                        |
| Google Play Console organization                 | Publish Android app                                                    | Not connected. Client completes organization verification, including applicable D-U-N-S/business/representative information and enrollment payment.                                       |
| Domain/DNS account                               | Public website/API, policy URLs and support identity                   | Domain not provided. Do not purchase an arbitrary name. Use the client's existing domain or an approved choice.                                                                           |
| Private source repository, e.g. GitHub           | Backup, review and remote CI                                           | Code is packaged and a CI workflow is included; no external repository has been created or linked. This is useful but not required to run the demo.                                       |

## Setup order

1. Continue the existing project `anvira-services`; do not create a duplicate. Firestore Standard `(default)` is in `asia-south1` with deny-all client rules. Functions are configured for the same region.
2. Google and Email/Password are enabled without changing billing. Keep Phone disabled. Configure Google signing fingerprints, authorized domains and EAS public OAuth IDs. Cloud Storage/Functions require Blaze if selected for deployment; choose hosting deliberately before launch. Keep staging isolated from production.
3. Matching native config files for the registered iOS/Android ID `com.anvira.services` were downloaded and verified locally on 6 October 2026. Supply those files through EAS file variables. Create the client Expo/EAS project and connect its public project ID.
4. The first Firebase Auth Owner, `anviraservicesllp@gmail.com`, was created on 6 October 2026 with verified email, an active Owner record and the Owner custom claim. The user set a separate app password directly in the browser; the password sign-in provider was verified afterward. Use **Owner & professional sign in** in ANVIRA. A Google account login alone is not the app's Owner record. Do not reuse the Google account password for ANVIRA staff.
5. Configure Razorpay test credentials through Secret Manager and verify the complete money lifecycle in staging. Do not use a service-account private key when the runtime's service identity can provide access.
6. Obtain approved policies, legal/business details, catalog/pricing and final assets. Complete Apple/Google organization enrollment with the client's authorized representative. Build and test signed native applications before submission.

## What has not been performed

Firebase project and web/native app entries exist; Firestore and email/password setup were completed. No Storage bucket, billing account, merchant account, store account or production deployment has been created by this handoff. No membership payments, real charges, bank payouts, invitation emails or private access grants were made. The account owner must complete identity checks, legal acceptance and financial enrollment where required; these cannot be inferred from a Gmail password.

## Official setup references

- [Firebase plans and billing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [EAS first build setup](https://docs.expo.dev/build/setup/)
- [Apple organization enrollment](https://developer.apple.com/programs/enroll/)
- [Play Console required organization information](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Razorpay payment gateway onboarding](https://razorpay.com/blog/payment-gateway-kyc-onboarding-india/)
- [RazorpayX payouts](https://razorpay.com/x/payouts/)

Console session note: Firebase signed this browser out after setup. Its Sign in control did not advance. Restore the session manually before continuing account configuration. Verified project/database/provider changes above were observed before sign-out.
