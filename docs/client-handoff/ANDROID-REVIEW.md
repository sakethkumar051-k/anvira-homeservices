# Client Android review

This is a review build using Razorpay TEST mode. SAMPLE services, prices, professionals, commission and earnings are fictional test data. No real service or settlement is promised.

Public support: **+91 79893 65699** · **anviraservicesllp@gmail.com**

## Install

1. Download the [finished Android review APK](https://expo.dev/artifacts/eas/a3KZ0SCRFazqrvCSmmLhT_B3-mqfrpVx6sEfrbqkZQ0.apk) on an Android phone. [Build details](https://expo.dev/accounts/sakethkumar051/projects/anvira/builds/c1bef7ea-0927-4f61-9bad-2d93978853ee).
2. Open the APK and approve Android's installation prompt for this download.
3. Open ANVIRA. Use the agreed review account or create an email/password customer account. Google sign-in needs the registered APK certificate; both review SHA fingerprints have been added to Firebase.
4. Keep an internet connection. The free backend can take over 50 seconds to wake after inactivity; retry the connection if the first request times out.

The build must be Finished and its APK downloaded before it is handed over as installable. A queued build is not an APK. This review APK is not a Play Store/App Store submission.

## Customer checks

- Invalid/empty email, password confirmation, password visibility, reset, Google login and sign-out.
- Service list, packages, required choices, details, PIN/address validation, slot conflicts and final total.
- Razorpay checkout: use test details only. Confirm successful payment from the booking, not only the bank screen. Check failure, dismissal and return-to-app behavior.
- Quote request, exact proposal approval, expiry, booking and duplicate request handling.
- Laundry progress and delivery, physical return/refund request, and booking-linked support.
- Profile, saved addresses, favorite services, home assets, reminder create/edit/pause/resume/delete, and care history.
- Offline/slow-network recovery, keyboard, back button, scrolling and permission prompts.
- Account deletion from Settings with fresh sign-in; active work/refunds must finish first.

## Owner and operations checks

- Sign in at https://anviraservices.com/staff after the reviewed source is deployed.
- Inspect SAMPLE catalog/professionals, service editor, quote pricing, booking assignment and support.
- Open Roles & settings → Booking value slabs. Preset: below ₹1,000 10%; ₹1,000–₹9,999 15%; ₹10,000–₹19,999 20%; ₹20,000+ 25%. Check duplicate thresholds and invalid percentages are rejected.
- Confirm in-house salary treatment and separate partner earnings. Test balances are separate from real wallets and cannot fund live payouts.
- Approve refund requests and verify provider status; a processing/reconciliation state is not a completed refund.
- Verify public About, services, enquiry validation, WhatsApp/email drafts, policy links and deletion-request page. An enquiry draft must still be sent by the person making the enquiry.

## Report a defect

Record phone model, Android version, APK version/build, test account role, screen, exact steps, expected result, actual message and a screenshot. Exclude passwords, OTPs, payment secrets and personal documents.

## Release evidence and remaining gates

The current run's status is recorded in ../PAYMENTS-AND-COMMISSION-REVIEW.md and ../MARKETPLACE-COMPLETION-2026-10-22.md. Before store publication complete physical-device acceptance, Razorpay hosted webhook/refund verification, notification delivery, approved business/pricing/policy data and developer enrollments.
