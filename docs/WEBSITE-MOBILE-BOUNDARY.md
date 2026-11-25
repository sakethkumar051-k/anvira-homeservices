# Website and mobile app boundary

The user clarified on 18 November 2026 that the website is a normal public services website plus the Owner/Customer Care admin portal. The native iPhone/Android app is the customer product being redesigned. The earlier publication of customer app routes on the website was a scope error.

## Website

- Public home, service categories, photos, promotional banners, service information, coverage enquiries, About Us and policy/account-deletion information.
- Service scope expands inline; enquiry links open a reviewable WhatsApp/email draft.
- Staff email sign-in at `/staff`, limited to approved Owner and Customer Care accounts.
- No customer OTP/registration, customer account, bookings, checkout selection, partner app or app-style bottom navigation.
- `npm run build:website` forces `EXPO_PUBLIC_WEBSITE_STAFF_ONLY=true`. Expo Router protects customer screens, while Vercel redirects direct customer URLs. `/sign-in` resolves to the staff portal.
- Hosted secure payment links used by native bookings remain an API integration, not public website booking screens.

## Mobile app

Customer discovery, the six service categories, package/quote selection, mobile OTP, addresses, slots, checkout, booking status and account/support remain native application features. Professional app journeys also remain outside the published website. Native behavior must not be removed while restoring the website boundary. Native redesign and signed-device verification are separate work from this website correction.

## Verification

`npm run test:ui:website` checks all six public categories, enquiries, absent customer links/navigation and direct-route protection. `STAFF_ONLY_TEST=true AUTH_WEB_DIST_DIR=dist npm run test:ui:auth` checks the website staff flow with fictional provider transport, including rejection of customer/professional identities and access for Owner/Care. Full application authentication fixtures require a separate app export with the website-only flag disabled; they are not the deployed website.

Current correction source: `1269e15`. The full 337-test suite, lint and TypeScript passed. Browser checks passed all six public categories, enquiry-only links, direct customer-route exclusion, staff-only email sign-in, rejection of customer/professional identities and access for Owner/Care (nine staff authentication scenarios). Vercel production deployment `G7Y8EgEaBDkyp1YSWW9hdz7dixbe` reached Ready and is aliased to `anviraservices.com`. Live browser checks confirm six categories, zero customer app links, no app bottom navigation and a staff email portal. Customer `/sign-in`, `/home`, `/services`, `/service/*`, `/bookings`, `/quotes` and `/checkout/:serviceId` URLs are redirected to staff/public information. Native and backend code were not changed by this correction.

Native verification setup: the existing iPhone 17 Pro simulator was booted and Expo Go 58 installed. The development environment-file parsing failure was subsequently reproduced and repaired; fresh native development bundles now succeed. See EXPO-GO-STARTUP.md for the cause, regression and acceptance evidence. Native CUA attachment also failed with an expired continuation; browser-based screenshots must not be described as native app verification.
