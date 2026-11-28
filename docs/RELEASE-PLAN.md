# ANVIRA production release plan

Updated 28 November 2026. The code is release-ready. Everything that remains is an account, console, business or device step. Step-by-step store instructions and the store form answers are in [STORE-SUBMISSION.md](STORE-SUBMISSION.md).

## Fixed in code (no action needed)

| Area | What changed |
| --- | --- |
| Launch | Production builds have the API address, Sign in with Apple, a correct icon and splash screen, and only the permissions they need. Builds fail early if the API address is missing. |
| Policies | Real Privacy Policy and Terms at `/privacy` and `/terms`. The old review links show them in live builds. |
| Payments | A Razorpay error can be retried. Customers see "Complete payment by [time]", and after the window closes they get "Book again" instead of a Pay button that no longer works. |
| Admin money actions | Refunds and payouts ask for confirmation. Payouts blocked by the bank check before sending return to the partner's balance (previously they stayed frozen in reconciliation). |
| Operations | An internal worker with upcoming visits cannot be deactivated until the visits are reassigned. Professionals are notified of cancellations, reschedules and reassignments. |
| Hosting | The free Render API keeps itself awake. Maintenance runs every 5 minutes to stay inside Firestore's free quota. Public catalogue responses are cached. |
| Website | Search engines can crawl it, each page has its own canonical URL, the sitemap lists `/catalog`, `/privacy` and `/terms`, and images are smaller (photos 4.0 MB → 2.6 MB). An unused 3.3 MB video was removed. |
| Safety | `.gitignore` now blocks every `.env*` file except the committed examples. |
| Database cost | Screens no longer reload all data every 30 seconds. They check a free "has anything changed?" signal every 15 seconds and reload only when something changed, so an admin dashboard left open all day stays inside Firebase's free read quota. |
| Admin dashboard | Overview shows revenue, bookings and average order value for the last 7 days with the change from the week before, paid conversion, customer rating, revenue by day, top services and today's visits. The sidebar shows how many orders, support requests and refunds are waiting. Reports load the last 30 days automatically. |
| Growth & marketing (new admin page) | Printable A4 poster with a QR code, copy-ready WhatsApp messages for each service, store links, customers who have not booked in 45+ days, and top customers. |
| Offers | One-tap templates (welcome, weekend, festive, win-back), a customer preview, a switch to show the offer in the app or keep it private, redemption tracking and WhatsApp sharing. |
| Customer app | Personal greeting, live visit tracker, one-tap "Book again", quick star rating after a visit, trust badges, offers on the home screen and at checkout, overall rating once there are 5+ reviews, "Share ANVIRA" invites, Call/WhatsApp support shortcuts, a policy-accurate FAQ and a profile with visit stats. |
| Professional app | A "Next job" card with time, address, Directions and the last 7 days' earnings. |

## Phase 1 — Accounts and configuration (owner, about 1 day)

1. **Razorpay live:** complete KYC, then put the live keys on Render (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ENVIRONMENT=live`). Register the live webhook at `https://anvira-api-staging.onrender.com/api/webhooks/razorpay`. Redeploy Render.
2. **Vercel:** set `EXPO_PUBLIC_RELEASE_CHANNEL=production` and redeploy. This removes the "Client preview · test mode" strip.
3. **Firebase Authentication:** enable the **Apple** provider. Confirm Phone, Google and Email are enabled. Add a test phone number for app reviewers.
4. **Legal details:** fill in `BUSINESS.address` and `BUSINESS.grievanceOfficer` in `src/lib/legal.ts`. Have the business approve the Privacy Policy and Terms, including the 48-hour complaint acknowledgement and the 7-day quality window. Push to `main` so the website redeploys.
5. **Admin → Roles & settings:** set the Terms URL to `https://anviraservices.com/terms` and the Privacy URL to `https://anviraservices.com/privacy`. Check the support phone, coverage PIN codes, prices and commission.
6. **Store accounts:** an Apple Developer Program membership (organization accounts need a D-U-N-S number) and a Google Play Console account. If the Play account is personal and was created after November 2023, plan for the 14-day closed test with 12 testers.

## Phase 2 — Build and test on real phones (developer, 1–2 days)

```bash
npx eas-cli@latest build --profile preview --platform all
```

Install the preview on one iPhone and one Android phone, then check:

- [ ] Phone sign-in with an Indian number, Google sign-in, Apple sign-in (iPhone), and email sign-in
- [ ] Browse without signing in → pick a package → sign in → you return to that checkout
- [ ] Book, then pay with a small live payment, and check the booking shows as paid
- [ ] Cancel the booking and approve the refund as Owner; the refund reaches the account
- [ ] A professional accepts the job, marks arrival, and completes it; the customer rates it
- [ ] Push notifications arrive with the app closed, and tapping one opens the booking
- [ ] Upload a professional profile photo (Android photo picker)
- [ ] Delete a test account from Profile → Account settings
- [ ] Leave the app idle for an hour, then open it; the catalogue loads quickly

## Phase 3 — Submit (developer, 1 day; store review takes 1–3 days)

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

1. Create the reviewer email account in the app and make one booking with it.
2. After the first Android upload, copy Play's app-signing SHA-1 and SHA-256 into Firebase. Then update the EAS `GOOGLE_SERVICES_ANDROID` file and rebuild Android.
3. Fill in the listings, screenshots, App Privacy and Data safety forms, and the reviewer notes from STORE-SUBMISSION.md.
4. Release to TestFlight and Internal testing first, install from there, then submit for review.
5. Once each store listing is live, paste its link into **Admin → Growth & marketing → Your links**. The links then appear on the website, the printable poster and every share message.

## Phase 4 — After launch (first month)

- When the client pays, move Render to the Starter plan and set `KEEP_AWAKE=false`. Consider the Firebase Blaze plan with a budget alert, so the free read quota can never take the app down.
- Turn on Firestore backups (requires Blaze) and do one restore test.
- Watch Render logs daily for errors. Check Admin → Automations for stuck jobs.
- Have a fluent speaker review the Telugu translations.

## Known limits (acceptable for launch)

- Professional and worker search filters apply to the current page of 100 records. Add server-side filters (with a Firestore index) before the roster grows past 100.
- Automatic assignment checks up to 200 approved professionals.
- GST tax invoices, partial refunds, chargebacks and customer–professional calling are not built. Booking receipts state that they are not tax invoices.
- Partner withdrawals (RazorpayX) stay disabled until RazorpayX is approved and a static IP is set up.
