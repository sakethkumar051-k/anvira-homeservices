# ANVIRA catalog and booking review

18–19 November 2026 · Shadnagar

## Audit and implementation order

The Express API, Firebase/SQLite store adapters, Expo Router app and browser-based Owner dashboard already share services and bookings. Booking creation calculates prices on the server, snapshots work and payment amounts, and uses transaction locks. The application has phone authentication, saved addresses, Razorpay checkout, office and partner dispatch, support and booking history. These are the foundations of the redesign.

| Priority | Finding in the starting code | Change to make |
|---|---|---|
| 1 | Service-wide extras applied to every package. A bathroom could be added to a sofa clean. Quantity and the time required for extras were missing. | Model package compatibility and units, enforce them when pricing and reserving a visit, keep historical bookings readable. |
| 2 | Native discovery inferred six categories from names. Other active categories disappeared, some empty categories remained, and the location label was static. | Derive discovery from published records, show the selected address, and share search and detail components between guest and customer. |
| 3 | The customer could configure work but had no central place to revisit saved selections. | Provide an editable visit cart and carry its selections through address, actual capacity, final review and payment. |
| 4 | The owner edited scope, price, packages and extras on a long form. A default rupee amount could look like a business decision. | Guide creation through pricing, scope, extras, availability and review. Store reusable categories and add-on templates. |
| 5 | The public website had three fixed promotional cards. The mobile app had no scheduled, owner-managed campaign inventory. | Provide an owner banner editor and use actual published destinations on both surfaces. |
| 6 | Existing release evidence related to older builds. | Exercise the new paths on an isolated catalog, run lint, typecheck and regression suites, then record remaining release gates. |

## Public competitor observations

Urban Company asks visitors for their city. Its Hyderabad bathroom listings compare scope, duration, price and room count together. The page displayed ₹529 and 60 minutes for its intensive single-bathroom entry, and ₹978 for two. An extra exhaust fan explicitly accounts for one already included. ANVIRA adopts the distinction between included work and additional units. [Urban Company home](https://www.urbancompany.com/) · [Hyderabad bathroom listing](https://www.urbancompany.com/hyderabad-professional-bathroom-cleaning)

NoBroker’s Hyderabad sofa listing displayed ₹329 and 45 minutes for sofa cleaning, and ₹599 and 75 minutes for a cushion-inclusive option. Its cards explain the cushion rule and expose further variants. ANVIRA can use that structure for comparisons and let an owner exclude duplicate extras. Prices elsewhere on the same page differ, which is a reason to attach benchmarks to a specific listing. [NoBroker sofa cleaning](https://www.nobroker.in/sofa-cleaning-services-in-hyderabad)

NoBroker describes address entry, slot selection, review and online payment. Urban Company describes matching a professional after selection and using its Help Center for appointment changes. These are the companies’ published descriptions. The research covered public sites only. Protected checkout, payment success and cancellation screens were outside this inspection. [NoBroker booking guide](https://www.nobroker.in/cleaning-services/home-cleaning-services-in-mulund-mumbai) · [Urban Company booking guide](https://www.urbancompany.com/near-me)

Broomees publishes a recurring home-help model with separate booking and subscription fees and assignment after the customer describes their needs. The transferable pattern is to distinguish a submitted request from a confirmed assignment. ANVIRA's initial one-time visits have no dependency on the subscription or replacement model. [Broomees service and subscription terms](https://broomees.com/bookingV2)

Likely friction points for ANVIRA include paying twice for an inclusion, mistaking diagnosis for a completed repair, losing options on sign-in and discovering an unsupported PIN at payment. These are product hypotheses based on the catalog and booking code. Track support cases and abandoned booking steps before drawing conclusions about customers. A membership programme, booking-count rankings and platform-wide guarantees require evidence or operations beyond the current launch.

## Proposed local catalog

The prior cloud handoff records six active services, with AC carrying reviewed pricing and the other five using office quotations. This work uses the repository record as context. It does not establish the current live inventory. Each row below is a planning proposal. Publishing requires an equipped worker for the area, agreed visit duration, approved scope and an owner-approved customer price.

| Category / subcategory | Service and variant | Model and extra work |
|---|---|---|
| Home cleaning / bathroom | One bathroom deep clean | Per bathroom. Optional additional bathroom only within visit capacity. Specify accessible fittings and surfaces; exclude restoration and plumbing. |
| Home cleaning / kitchen | Kitchen surface clean | Fixed scope for counters, sink and accessible cabinet exteriors. Appliance interiors require a separately approved scope. |
| Home cleaning / upholstery | Fabric sofa cleaning | Per seat or an explicitly sized package. Check fabric suitability, seat count and drying time. Offer cushions only when excluded from the selected package. |
| Home cleaning / whole home | Occupied one- or two-bedroom home | Package or written quote based on size, furnished condition and included bathrooms. Balcony or additional bathroom only when within capacity. |
| AC services / maintenance and repair | Routine clean, deep clean, fault diagnosis | Keep the reviewed rate attached to its original scope. Diagnosis covers the visit. Obtain approval for parts, refrigerant and repair labour. |
| Water purifier / RO | Routine service, filter-fitting labour, installation | Quote by model and compatible parts. State separately who supplies cartridges and membranes. |
| Plumbing / repairs and fittings | Inspect a leak, clear one accessible trap, fit a supplied tap | Charge an approved diagnostic fee or offer an agreed fixed labour package. Concealed pipework needs a separate assessment. |
| Electrical / repairs and fittings | Diagnose one fault or fit a compatible switch or fan | Quote for diagnosis or fixed labour on an existing safe point. Parts, rewiring and unsafe access require a separate decision. |
| Car care / doorstep cleaning | Monthly Car Care | The team confirms cleaning scope, visits per month, parking access, monthly price and start date. Request and proposal acceptance are available in the app. The team arranges billing separately. |
| Appliance repair, painting and pest control | Candidate categories | Keep in planning until trade qualifications, equipment, area and pricing have been checked. |

### Draft costing for owner review

Use local paid crew time including setup, round-trip travel allocation, materials, payment costs and a contribution for support/rework. Example assumptions below are **illustrative internal estimates** in rupees. They have no source in local payroll or contractor quotes. Validate them against trial visits in Shadnagar before entering rates. The working calculation divides direct cost by 0.80 for an assumed 20% contribution before taxes, with prices rounded to the next ₹10.

| Proposed scope | Labour | Travel | Materials and payment costs | Illustrative price |
|---|---:|---:|---:|---:|
| One bathroom, bounded deep clean | 280 | 70 | 65 | ₹520 |
| One fabric sofa, up to three seats | 360 | 80 | 100 | ₹680 |
| One plumbing inspection, excluding repairs | 150 | 65 | 10 | ₹290 |

An extra unit on the same visit should use incremental labour, materials and time. Reassess margins if the visit requires another worker or trip. Confirm tax treatment, coverage, operating hours, repair approval, cancellation cut-off and realistic weekly capacity with the owner. The table supplies no published rates, tax determination or guarantees.

## Implementation report

| Area | Delivered |
|---|---|
| Customer home and discovery | Native guest browsing before sign-in, published category grid, package-aware search, saved-address picker, photographs, a featured-service slideshow, booking shortcut and support. The public website also reads the published catalog and slideshow. |
| Service detail | A persistent booking action, package and scope comparison, preparation, visit checklist, FAQ and compatible optional add-ons. Guest selections carry through sign-in. Quote services can offer scope options and pass the selected scope into the quote request. |
| Cart and booking | One saved configuration per service on the device. Each visit is edited, scheduled and paid independently because availability and dispatch are reserved per visit. Checkout shows quantity, package, choices, extras, discounts and server-verified payable amount. The address, work and prices are captured on the booking. |
| Owner | Searchable services with status and price, six-step editor, category directory, add-on templates and service-specific assignments. Draft, active, paused and unavailable states. Optional service PIN restrictions, preview, publish and concurrent edit checks. A separate banner section supports photo upload, service destination, order and start/end dates in India time. |
| Backend | Booking, availability and quote requests intersect service coverage with company PIN codes. Existing bookings retain their booked scope, total and duration. Current capacity drives instant booking. Staff handle tailored quotations and fulfilment through the existing office workflow. |

### Data and rollout

The schema additions are backward compatible with existing Firestore and SQLite records. Services without a lifecycle field continue to use their stored publication flag. Services without PIN restrictions inherit company coverage. Missing quantity is one unit. Existing add-ons without a package restriction retain their service-wide scope until an owner reviews them.

The API writes the service library and banner metadata under `settings`. Uploaded JPEGs live in `bannerPhotos`, which the existing encrypted snapshot tool includes. Only the Owner can mutate those records. The public photo endpoint requires a currently displayed banner and a published destination. There is no destructive migration or backfill. For rollout, take an encrypted snapshot and deploy the API before distributing the client. Source rollback leaves the additive records in place. The data changes in this task used isolated test stores only.

The six-service **demo** catalog has explicit package rules for selected cleaning and AC extras. Car Care is presented as a monthly plan, while an isolated historical fixture still exercises the earlier one-visit checkout. Its prices remain fictional. The cost model in this report is an internal draft. No change was applied to the live service catalog, including the reviewed AC rate or existing live add-ons.

### Modified files

- API and model: `server/app.mjs`, `server/routes/{banners,service-quotes}.mjs`, `server/lib/{backup,domain,sample-catalog,schemas,service-quotes,service-selection}.mjs`, `src/lib/{context.tsx,marketplace.ts,model.ts,office-ui.ts,service-catalog.ts,sign-in.ts,translations.json,visit-cart.ts}`.
- Customer: `src/app/{_layout,cart,index}.tsx`, `src/components/{Customer,DemoLogin,Experience,GuestCatalog,Marketplace.web,PromotionalCarousel,ServiceCatalog,ServicePhoto,ServiceQuotes,Shell,SignIn,VisitCart}.tsx`.
- Owner: `src/components/{BannerManager,CatalogLibrary,Operations,ServiceAddonsEditor,ServiceCustomization,Workbench}.tsx`.
- Verification: `tests/{api,guided-service-pricing,launch,marketplace-discovery,production,service-pricing-backend,service-quotes,visit-cart}.test.mjs` and the `browser`, `browser-features`, `browser-launch`, `browser-public-website`, `browser-service-management`, `browser-banners`, `browser-catalog-publishing` and `browser-visit-cart` scripts.

### Production decisions

- Confirm which proposed scopes, prices and optional work the current Shadnagar team can deliver. Review the add-on eligibility of existing production services before changing their publication status.
- Confirm taxes, receipt requirements, supported payment methods, cancellation terms and staffed support details. The redesigned checkout uses the existing prepaid settlement and has no separate GST or fee rule. Pay-after-service and cross-visit payment require business and provider configuration.
- Verify actual signed devices, production Firebase sign-in and the Razorpay merchant payment and refund loop before releasing. This work uses the existing owner web portal and customer mobile routing.

### Verification

- `npm run check` passed Expo lint, TypeScript and 347 automated tests. Coverage includes incompatible add-ons, changed-price rejection, PIN restrictions, legacy request retries, duplicate reservations, quote ownership, payment verification and booking snapshots.
- The Firestore emulator passed its five tests and its 1,095-request stress check. The run covered transaction conflicts, data permissions and isolated professional assignments.
- Expo successfully exported web, iOS and Android bundles. Expo Go on an iPhone 17 Pro simulator displayed the customer home and service detail. A repeat sign-in after the focus fix cleared the earlier API rate-limit error. These were development checks.
- Chromium passed the focused cart workflow at a 390-pixel viewport, including a forced payment failure, safe retry and receipt. Discovery covered packages, compatible extras, sign-in handoff, search and the empty state. The Owner checks covered category and template creation, package assignment, draft preview, publish, pause, and propagation to the public catalog. The banner check covered image upload, manual pagination, reduced motion, navigation and expiration.
- The general browser suite passed all 21 scenarios. The feature suite passed eight and the launch suite passed six. Browser regressions covered detailed service configuration, quote acceptance and reservation, paid booking, professional completion, support replies, historical scope and publication changes. Website checks covered the six launch categories, mobile overflow, PIN coverage, desktop navigation and the staff-only boundary.

Simulator screenshots: [Home](../evidence/catalog-redesign-ios-home.png) and [service detail](../evidence/catalog-redesign-ios-detail.png).

To repeat the focused browser checks, use a demo web export and run `node tests/browser-visit-cart.cjs`, `node tests/browser-catalog-publishing.cjs` and `node tests/browser-banners.cjs`. Each starts its own API and temporary SQLite database. The scripts use `dist-demo` by default and accept `WEB_DIST_DIR` for a different export. The browser runner accepts `CHROMIUM_EXECUTABLE` when the Playwright browser is unavailable.
