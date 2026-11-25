# Mobile experience review — 24 November 2026

The customer journey was inspected screen by screen at mobile width, then revised using ANVIRA’s forest green, warm white surfaces, Manrope and Telugu fonts. Existing booking prices, availability checks, quote approvals and payments remain authoritative on the server.

| Screen | Findings addressed | Evidence in `evidence/mobile-redesign/` |
| --- | --- | --- |
| Home | Crowded header; promotions displaced discovery; navigation covered content. Compact location header, categories first, clear search, separate monthly Car Care feature and upcoming visit. | `01-home-before.png`, `01-home-after.png` |
| Services | Repetitive labels and cramped service cards. Clearer card spacing, prices and duration; category tiles and filter selection states. | `02-services-after.png` |
| Service details | Large image delayed useful information. Shorter hero, readable package selection, clear scope and fixed action area. | `03-service-after.png` |
| Booking: service | Unlabelled progress, repeated full inclusions for every package. Named steps, compact service summary, concise options and selected scope. | `04-cart-before.png`, `04-cart-after.png` |
| Booking: address and time | Saved addresses looked like generic buttons. Selected-address cards, clear fields, separate calendar card, day/date/month layout and touch-friendly time choices. Header Back returns to the prior step; Android hardware Back follows the same sequence. | `05-address-time-after.png` |
| Booking: review | Long scope hid appointment and price. Visit details and payment summary now come first; inclusions and exclusions remain available below. | `06-summary-before.png`, `06-summary-after.png` |
| Booking details | Payment was buried below progress and professional information. Payment action is now prominent; timeline is easier to scan. | `07-detail-payment-after.png`, `07-detail-paid-after.png` |
| Bookings | Weak selected states and repetitive cards. Segmented upcoming/past views, service thumbnails, clear status and date, contextual empty states. | `07-bookings-after.png` |
| Notifications | Two settings cards preceded the inbox. Updates now come first; preferences expand below. Clear unread indicators, readable status labels, timestamps and mark-read control. Unread filtering explicitly describes page-local results when older pages exist. | `08-notifications-before.png`, `08-notifications-after.png` |
| Profile | A long stack of identical action buttons. Grouped account/help rows with icons and compact dividers. | `09-profile-before.png`, `09-profile-after.png` |
| Addresses | Empty add form always came before saved addresses. Saved-address list now comes first; add/edit forms open when needed, with local validation and removable confirmation. | `10-addresses-after.png` |
| Support | Large topic buttons competed with the message. Compact single-choice topics, clearer request form and separate request history. | `11-support-after.png` |
| Saved cart | Weak empty-state action and competing remove buttons. Primary browse action when empty; compact service cards and quieter remove action for saved visits. | `12-saved-cart-after.png` |
| Account | Form lacked context. Clear details section and consistent shared form styling. | `13-account-after.png` |
| Home care passport | A long informational note displaced useful actions. Shorter introduction; record limitations remain below the actual tools. | `14-care-after.png` |
| Quotes / monthly plan | Refresh occupied a full primary-looking row; service choices consumed multiple rows. Compact heading action and horizontal service choices; monthly pricing and scheduling explanation retained. | `15-quotes-after.png` |
| Professional jobs | Empty offers and a promotional block displaced assigned work. Work summary and schedule now lead; offers shown for external partners. | `17-jobs-after.png` |
| Professional earnings | In-house staff saw an irrelevant partner wallet balance. In-house compensation explanation and job-history action replace the partner wallet for that account type. | `18-earnings-after.png` |
| Professional profile | Approved staff were shown recruitment copy. Approved profiles now have an appropriate heading and consistent schedule controls. | `19-pro-profile-after.png` |
| Native welcome, guest catalog, sign-in | Desktop-sized introductory content and crowded headers delayed actions. Mobile welcome with stable actions, compact guest header and sign-in form without a decorative illustration above it. | `27-welcome-native-layout.png`, `27-catalog-native-layout.png`, `27-sign-in-native-layout.png` |

Shared layout changes: fixed header; bottom navigation occupies its own space instead of covering content; checkout footer takes its actual content height; iOS keyboard avoidance; active tabs recognize detail routes; repeated tab taps do not push duplicate screens. The staging banner is now a small noninteractive label rather than a second content header consuming vertical space.

English and Telugu labels were completed for the affected customer journey, account/home-care tools, and professional navigation. Narrow Telugu captures include `20-home-telugu-320.png`, `22-checkout-telugu-320.png` through `26-addresses-telugu-320.png`, and `28-pro-jobs-telugu-320.png`.

## Validation

- `npm run check`: lint, TypeScript, 359 unit tests.
- `npm run test:ui:mobile`: 24 customer screen captures/checks on a fresh isolated demo database, including booking and demo payment, previous-step navigation, read/unread notifications, older unread-page empty state, saved address, and 320px Telugu screens. This suite checks visible content before taking captures and rejects page overflow and native text-rendering warnings.
- Existing browser suite: 21 scenarios, including customer/professional messages, service execution, quality/support queues, professional onboarding and workspace switching; zero browser runtime errors.
- Existing mobile visit-cart suite: compatible extras, quantity, saved draft, unsupported PIN, availability, editing, price snapshot, payment failure/retry and cart cleanup.
- Telugu website/customer/Owner monthly-plan suite: persistent language, localized search, customer request and Owner pricing at 320px.
- Expo iOS/Android exports and native component AST checks for unwrapped text, including inline whitespace.
- Independent read-only review found the page-local unread empty-state issue; corrected and covered by a browser scenario.

Screenshots use mobile browser rendering. Native-only welcome/catalog layouts were temporarily mounted for visual inspection; the temporary review route was removed. Device keyboard, VoiceOver/TalkBack and gesture behavior still need hands-on device checks. These source changes are available through Expo Go; this UI pass does not rebuild the previously delivered APK or publish a store release.
